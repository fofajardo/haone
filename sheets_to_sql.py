#!/usr/bin/env python3
"""
Convert Google Sheets CSV exports to Supabase SQL.

Usage:
  python3 scripts/sheets_to_sql.py --input-dir /path/to/csvs --output-file migration.sql
"""

import argparse
import csv
import glob
import os
import re
import sys
import uuid
from datetime import datetime
from typing import overload


def parse_date(val: str | None) -> str | None:
    """Parse date string into YYYY-MM-DD or None."""
    if not val:
        return None
    val = val.strip()
    if not val or val.lower() in ("null", "none", "n/a", "-"):
        return None

    # Handle standard YYYY-MM-DD
    if re.match(r"^\d{4}-\d{1,2}-\d{1,2}", val):
        parts = val.split("T")[0].split(" ")[0].split("-")
        try:
            return f"{int(parts[0]):04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"
        except (ValueError, IndexError):
            return None

    # Handle M/D/YYYY or MM/DD/YYYY
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})", val)
    if m:
        month, day, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return f"{year:04d}-{month:02d}-{day:02d}"

    # Handle YYYY/MM/DD
    m = re.match(r"^(\d{4})/(\d{1,2})/(\d{1,2})", val)
    if m:
        year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return f"{year:04d}-{month:02d}-{day:02d}"

    try:
        dt = datetime.fromisoformat(val)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_timestamp(val: str | None) -> str | None:
    """Parse timestamp string into ISO timestamp with timezone or None."""
    if not val:
        return None
    val = val.strip()
    if not val or val.lower() in ("null", "none", "n/a", "-"):
        return None

    # M/D/YYYY H:MM:SS or M/D/YYYY
    m = re.match(
        r"^(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?", val
    )
    if m:
        month, day, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        hour = int(m.group(4) or 0)
        minute = int(m.group(5) or 0)
        second = int(m.group(6) or 0)
        return (
            f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:02d}+08"
        )

    # Already ISO-like
    if re.match(r"^\d{4}-\d{2}-\d{2}", val):
        return val

    return None


@overload
def parse_numeric(val: str | None, default: float) -> float: ...


@overload
def parse_numeric(val: str | None, default: None) -> float | None: ...


@overload
def parse_numeric(val: str | None) -> float: ...


def parse_numeric(val: str | None, default: float | None = 0.0) -> float | None:
    """Parse currency / numeric string."""
    if val is None:
        return default
    val = str(val).strip()
    if not val or val.lower() in ("null", "none", "-", "n/a"):
        return default
    # Remove currency symbols, commas, spaces
    cleaned = re.sub(r"[^\d.-]", "", val)
    if not cleaned or cleaned == "-":
        return default
    try:
        return float(cleaned)
    except ValueError:
        return default


@overload
def parse_int(val: str | None, default: int) -> int: ...


@overload
def parse_int(val: str | None, default: None) -> int | None: ...


@overload
def parse_int(val: str | None) -> int: ...


def parse_int(val: str | None, default: int | None = 0) -> int | None:
    """Parse integer string."""
    num = parse_numeric(val, default=None)
    if num is None:
        return default
    return int(num)


def parse_bool(val: str | None, default: bool = False) -> bool:
    """Parse boolean value."""
    if not val:
        return default
    v = str(val).strip().upper()
    if v in ("TRUE", "1", "YES", "T", "Y"):
        return True
    if v in ("FALSE", "0", "NO", "F", "N"):
        return False
    return default


def parse_tags(val: str | None) -> list[str] | None:
    """Parse colon or comma delimited tag string into list."""
    if not val:
        return None
    val = str(val).strip()
    if not val:
        return None
    delim = ":" if ":" in val else ","
    tags = [t.strip() for t in val.split(delim) if t.strip()]
    return tags if tags else None


def sql_str(val: str | None) -> str:
    """Escape and quote SQL text."""
    if val is None:
        return "NULL"
    s = str(val).replace("'", "''")
    return f"'{s}'"


def sql_uuid(val: str | None) -> str:
    """Validate/format UUID or NULL."""
    if not val:
        return "NULL"
    val = str(val).strip()
    try:
        u = uuid.UUID(val)
        return f"'{u!s}'"
    except ValueError:
        return "NULL"


def sql_num(val: float | None) -> str:
    """Format numeric for SQL."""
    if val is None:
        return "NULL"
    return f"{val:.2f}"


def sql_int(val: int | None) -> str:
    """Format int for SQL."""
    if val is None:
        return "NULL"
    return str(val)


def sql_bool(val: bool) -> str:
    """Format boolean for SQL."""
    return "TRUE" if val else "FALSE"


def sql_array(val: list[str] | None) -> str:
    """Format string array for PostgreSQL."""
    if not val:
        return "NULL"
    escaped_items = [sql_str(item) for item in val]
    return f"ARRAY[{', '.join(escaped_items)}]::TEXT[]"


def normalize_email(val: str | None) -> str | None:
    """Lowercase and strip email."""
    if not val:
        return None
    e = val.strip().lower()
    return e if e else None


def clean_row(row: list[str]) -> list[str]:
    """Strip whitespace from raw CSV row cells."""
    return [cell.strip() for cell in row]


def read_csv_rows(filepath: str) -> list[list[str]]:
    """Read CSV file handling encoding and returning non-empty rows."""
    if not os.path.exists(filepath):
        return []
    with open(filepath, "r", encoding="utf-8-sig", errors="replace") as f:
        reader = csv.reader(f)
        rows = []
        for r in reader:
            if not r or all(c.strip() == "" for c in r):
                continue
            rows.append(clean_row(r))
        return rows


def find_csv(csv_dir: str, base_names: list[str]) -> str | None:
    """Find CSV file matching any of the candidate base names."""
    files = glob.glob(os.path.join(csv_dir, "*.csv"))
    name_map = {os.path.splitext(os.path.basename(f))[0].lower(): f for f in files}
    for b in base_names:
        key = b.lower()
        if key in name_map:
            return name_map[key]
    return None


class MigrationBuilder:
    def __init__(self, csv_dir: str):
        self.csv_dir = csv_dir
        self.sql_lines: list[str] = []

        # Lookup caches:
        # email -> user_id
        self.email_to_user_id: dict[str, str] = {}
        # student_no -> user_id
        self.stno_to_user_id: dict[str, str] = {}
        # user_ids present
        self.known_user_ids: set[str] = set()
        # achievement_ids present
        self.known_achievement_ids: set[str] = set()

        # Prepopulate known system accounts
        self.system_users = {
            "_funds": "65eb6240-8200-48dd-a1b9-01c5994c77d7",
            "_imported": "45ee82f7-103f-4607-80b8-6377a76441b7",
            "_dummy": "62383fc4-ce56-407e-adb0-962f0c77a132",
        }
        for email, uid in self.system_users.items():
            self.email_to_user_id[email] = uid
            self.known_user_ids.add(uid)

    def resolve_user_id(self, ref: str | None) -> str | None:
        """Resolve a user reference (UUID, email, or student_no) to a UUID."""
        if not ref:
            return None
        ref = ref.strip()
        if not ref:
            return None

        # Check if already a valid UUID
        try:
            u = str(uuid.UUID(ref))
            if u in self.known_user_ids:
                return u
        except ValueError:
            pass

        # Check email
        low = ref.lower()
        if low in self.email_to_user_id:
            return self.email_to_user_id[low]

        # Check student no
        if ref in self.stno_to_user_id:
            return self.stno_to_user_id[ref]

        return None

    def process_users(self) -> None:
        path = find_csv(self.csv_dir, ["users", "user"])
        if not path:
            print("Notice: No users.csv found. Creating system users only.")
        rows = read_csv_rows(path) if path else []

        # Check header
        if rows and ("email" in rows[0][0].lower() or "id" in rows[0][-1].lower()):
            rows = rows[1:]

        user_inserts: list[str] = []

        # Ensure system users inserted first
        for name, uid in self.system_users.items():
            user_inserts.append(
                f"({sql_uuid(uid)}, {sql_str(name)}, {sql_str(name.upper())}, 'System Account')"
            )

        for r in rows:
            if not r:
                continue
            email = normalize_email(r[0]) if len(r) > 0 else None
            if not email:
                continue

            last_name = r[1] if len(r) > 1 and r[1] else None
            first_name = r[2] if len(r) > 2 and r[2] else None
            middle_name = r[3] if len(r) > 3 and r[3] else None
            suffix = r[4] if len(r) > 4 and r[4] else None
            override_name = r[5] if len(r) > 5 and r[5] else None
            # cols 6, 7 are display_name, display_name_fl (computed)
            student_no = r[8] if len(r) > 8 and r[8] else None
            secondary_contact = r[9] if len(r) > 9 and r[9] else None
            address = r[10] if len(r) > 10 and r[10] else None
            college = r[11] if len(r) > 11 and r[11] else None
            degree_program = r[12] if len(r) > 12 and r[12] else None
            tags = parse_tags(r[13]) if len(r) > 13 else None
            notes = r[14] if len(r) > 14 and r[14] else None

            raw_id = r[15] if len(r) > 15 and r[15] else None
            uid = None
            if raw_id:
                try:
                    uid = str(uuid.UUID(raw_id.strip()))
                except ValueError:
                    uid = None
            if not uid:
                uid = str(uuid.uuid4())

            self.email_to_user_id[email] = uid
            if student_no:
                self.stno_to_user_id[student_no.strip()] = uid
            self.known_user_ids.add(uid)

            val = (
                f"({sql_uuid(uid)}, {sql_str(email)}, {sql_str(last_name)}, {sql_str(first_name)}, "
                f"{sql_str(middle_name)}, {sql_str(suffix)}, {sql_str(override_name)}, {sql_str(student_no)}, "
                f"{sql_str(secondary_contact)}, {sql_str(address)}, {sql_str(college)}, {sql_str(degree_program)}, "
                f"{sql_array(tags)}, {sql_str(notes)})"
            )
            user_inserts.append(val)

        if user_inserts:
            self.sql_lines.append(
                "-- ── users ──────────────────────────────────────────────────"
            )
            self.sql_lines.append(
                "INSERT INTO users (id, email, last_name, first_name, middle_name, suffix, override_name, "
                "student_no, secondary_contact, address, college, degree_program, tags, notes)\n"
                "VALUES\n  " + ",\n  ".join(user_inserts) + "\n"
                "ON CONFLICT (id) DO UPDATE SET\n"
                "  email = EXCLUDED.email,\n"
                "  last_name = EXCLUDED.last_name,\n"
                "  first_name = EXCLUDED.first_name,\n"
                "  middle_name = EXCLUDED.middle_name,\n"
                "  suffix = EXCLUDED.suffix,\n"
                "  override_name = EXCLUDED.override_name,\n"
                "  student_no = EXCLUDED.student_no,\n"
                "  secondary_contact = EXCLUDED.secondary_contact,\n"
                "  address = EXCLUDED.address,\n"
                "  college = EXCLUDED.college,\n"
                "  degree_program = EXCLUDED.degree_program,\n"
                "  tags = EXCLUDED.tags,\n"
                "  notes = EXCLUDED.notes;\n"
            )

    def process_officers(self) -> None:
        path = find_csv(self.csv_dir, ["directory", "officers"])
        if not path:
            return
        rows = read_csv_rows(path)
        if rows and "position" in rows[0][0].lower():
            rows = rows[1:]

        inserts = []
        for r in rows:
            if not r:
                continue
            position = r[0] if len(r) > 0 and r[0] else None
            name = r[1] if len(r) > 1 and r[1] else None
            nickname = r[2] if len(r) > 2 and r[2] else None
            email = normalize_email(r[3]) if len(r) > 3 else None
            if not email:
                continue
            fb_link = r[4] if len(r) > 4 and r[4] else None
            term = r[5] if len(r) > 5 and r[5] else None
            committee = r[6] if len(r) > 6 and r[6] else None
            birthday = parse_date(r[7]) if len(r) > 7 else None
            raw_id = r[8] if len(r) > 8 and r[8] else None
            raw_status = r[9].strip().upper() if len(r) > 9 and r[9] else "ACTIVE"
            status = raw_status if raw_status in ("ACTIVE", "INACTIVE") else "ACTIVE"

            uid = None
            if raw_id:
                try:
                    uid = str(uuid.UUID(raw_id.strip()))
                except ValueError:
                    uid = None
            if not uid:
                uid = str(uuid.uuid4())

            inserts.append(
                f"({sql_uuid(uid)}, {sql_str(position)}, {sql_str(name)}, {sql_str(nickname)}, {sql_str(email)}, "
                f"{sql_str(fb_link)}, {sql_str(term)}, {sql_str(committee)}, {sql_str(birthday)}, {sql_str(status)})"
            )

        if inserts:
            self.sql_lines.append(
                "-- ── officers ───────────────────────────────────────────────"
            )
            self.sql_lines.append(
                "INSERT INTO officers (id, position, name, nickname, email, fb_link, term, committee, birthday, status)\n"
                "VALUES\n  " + ",\n  ".join(inserts) + "\n"
                "ON CONFLICT (id) DO NOTHING;\n"
            )

    def process_constants(self) -> None:
        path = find_csv(self.csv_dir, ["constants", "constant"])
        if not path:
            return
        rows = read_csv_rows(path)
        if rows and "key" in rows[0][0].lower():
            rows = rows[1:]

        inserts = []
        for r in rows:
            if not r or not r[0]:
                continue
            key = r[0].strip()
            value = r[1] if len(r) > 1 else None
            desc = r[2] if len(r) > 2 else None
            inserts.append(f"({sql_str(key)}, {sql_str(value)}, {sql_str(desc)})")

        if inserts:
            self.sql_lines.append(
                "-- ── constants ──────────────────────────────────────────────"
            )
            self.sql_lines.append(
                "INSERT INTO constants (key, value, description)\n"
                "VALUES\n  " + ",\n  ".join(inserts) + "\n"
                "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;\n"
            )

    def process_accounts(self) -> None:
        path = find_csv(self.csv_dir, ["accounts", "account"])
        if not path:
            return
        rows = read_csv_rows(path)
        if rows and "id" in rows[0][0].lower() and "period" in rows[0][2].lower():
            rows = rows[1:]

        inserts = []
        seen_keys = set()
        for r in rows:
            if not r:
                continue
            raw_id = r[0] if len(r) > 0 and r[0] else None
            res_ref = r[1] if len(r) > 1 and r[1] else None
            period = r[2].strip() if len(r) > 2 and r[2] else None
            if not period or not res_ref:
                continue

            resident_id = self.resolve_user_id(res_ref)
            if not resident_id:
                # Unable to link resident
                continue

            pair = (resident_id, period)
            if pair in seen_keys:
                continue
            seen_keys.add(pair)

            room = r[3] if len(r) > 3 and r[3] else None
            bed = r[4] if len(r) > 4 and r[4] else None
            ce_refno = r[5] if len(r) > 5 and r[5] else None
            ce_issued = parse_date(r[6]) if len(r) > 6 else None
            ce_link = r[7] if len(r) > 7 and r[7] else None
            notes = r[8] if len(r) > 8 and r[8] else None
            issuer_ref = r[9] if len(r) > 9 and r[9] else None
            issuer_id = self.resolve_user_id(issuer_ref)
            check_in_date = parse_date(r[10]) if len(r) > 10 else None

            raw_type = r[11].strip().upper() if len(r) > 11 and r[11] else "STUDENT"
            if raw_type == "ALUMNI":
                raw_type = "ALUMNUS"
            if raw_type not in ("STUDENT", "BOOTCAMP", "TRANSIENT", "ALUMNUS", "FACULTY", "STAFF", "REPS"):
                raw_type = "STUDENT"

            uid = None
            if raw_id:
                try:
                    uid = str(uuid.UUID(raw_id.strip()))
                except ValueError:
                    uid = None
            if not uid:
                uid = str(uuid.uuid4())

            inserts.append(
                f"({sql_uuid(uid)}, {sql_uuid(resident_id)}, {sql_str(period)}, {sql_str(room)}, {sql_str(bed)}, "
                f"{sql_str(ce_refno)}, {sql_str(ce_issued)}, {sql_str(ce_link)}, {sql_str(notes)}, "
                f"{sql_uuid(issuer_id)}, {sql_str(check_in_date)}, {sql_str(raw_type)})"
            )

        if inserts:
            self.sql_lines.append(
                "-- ── accounts ───────────────────────────────────────────────"
            )
            self.sql_lines.append(
                "INSERT INTO accounts (id, resident_id, period, room, bed, ce_ref_no, ce_issued, ce_link, account_notes, issuer_id, check_in_date, type)\n"
                "VALUES\n  " + ",\n  ".join(inserts) + "\n"
                "ON CONFLICT (resident_id, period) DO UPDATE SET\n"
                "  room = EXCLUDED.room,\n"
                "  bed = EXCLUDED.bed,\n"
                "  ce_ref_no = EXCLUDED.ce_ref_no,\n"
                "  ce_issued = EXCLUDED.ce_issued,\n"
                "  ce_link = EXCLUDED.ce_link,\n"
                "  account_notes = EXCLUDED.account_notes,\n"
                "  issuer_id = EXCLUDED.issuer_id,\n"
                "  check_in_date = EXCLUDED.check_in_date,\n"
                "  type = EXCLUDED.type;\n"
            )

    def process_settings(self) -> None:
        path = find_csv(self.csv_dir, ["settings", "user_settings"])
        if not path:
            return
        rows = read_csv_rows(path)
        if rows and "resident" in rows[0][0].lower():
            rows = rows[1:]

        inserts = []
        for r in rows:
            if not r or not r[0]:
                continue
            res_id = self.resolve_user_id(r[0])
            if not res_id:
                continue

            is_pub = parse_bool(r[1], default=True) if len(r) > 1 else True
            res_nav = r[2] if len(r) > 2 and r[2] else None
            admin_nav = r[3] if len(r) > 3 and r[3] else None
            density = r[4].strip() if len(r) > 4 and r[4] else "default"
            typography = r[5].strip() if len(r) > 5 and r[5] else "inter"
            theme = r[6].strip().lower() if len(r) > 6 and r[6] else "system"
            if theme not in ("system", "light", "dark"):
                theme = "system"
            is_reduced = parse_bool(r[7], default=False) if len(r) > 7 else False
            clock_format = r[8].strip().lower() if len(r) > 8 and r[8] else "12h"
            if clock_format not in ("12h", "24h"):
                clock_format = "12h"
            calendar_view = r[9].strip().lower() if len(r) > 9 and r[9] else "week"

            inserts.append(
                f"({sql_uuid(res_id)}, {sql_bool(is_pub)}, {sql_str(res_nav)}, {sql_str(admin_nav)}, "
                f"{sql_str(density)}, {sql_str(typography)}, {sql_str(theme)}, {sql_bool(is_reduced)}, "
                f"{sql_str(clock_format)}, {sql_str(calendar_view)})"
            )

        if inserts:
            self.sql_lines.append(
                "-- ── user_settings ──────────────────────────────────────────"
            )
            self.sql_lines.append(
                "INSERT INTO user_settings (resident_id, is_public_achievement_list, resident_nav, admin_nav, density, typography, theme, is_reduced_motion, clock_format, calendar_view)\n"
                "VALUES\n  " + ",\n  ".join(inserts) + "\n"
                "ON CONFLICT (resident_id) DO NOTHING;\n"
            )

    def process_announcements(self) -> None:
        path = find_csv(self.csv_dir, ["announcements", "announcement"])
        if not path:
            return
        rows = read_csv_rows(path)
        if rows and "id" in rows[0][0].lower():
            rows = rows[1:]

        inserts = []
        for r in rows:
            if not r:
                continue
            raw_id = r[0] if len(r) > 0 and r[0] else None
            creator_id = self.resolve_user_id(r[1]) if len(r) > 1 else None
            created_at = parse_timestamp(r[2]) if len(r) > 2 else None
            start_date = parse_date(r[3]) if len(r) > 3 else None
            expiry_date = parse_date(r[4]) if len(r) > 4 else None
            is_indefinite = parse_bool(r[5], default=False) if len(r) > 5 else False
            is_admin_only = parse_bool(r[6], default=False) if len(r) > 6 else False
            tags = parse_tags(r[7]) if len(r) > 7 else None
            title = r[8] if len(r) > 8 and r[8] else None
            content = r[9] if len(r) > 9 and r[9] else None
            is_unlisted = parse_bool(r[10], default=False) if len(r) > 10 else False
            slug = r[11].strip() if len(r) > 11 and r[11] else None
            broadcast_count = parse_int(r[12], default=0) if len(r) > 12 else 0

            # Consistency check
            if start_date and expiry_date and expiry_date < start_date:
                expiry_date = start_date

            uid = None
            if raw_id:
                try:
                    uid = str(uuid.UUID(raw_id.strip()))
                except ValueError:
                    uid = None
            if not uid:
                uid = str(uuid.uuid4())

            inserts.append(
                f"({sql_uuid(uid)}, {sql_uuid(creator_id)}, {sql_str(created_at) if created_at else 'NOW()'}, "
                f"{sql_str(start_date)}, {sql_str(expiry_date)}, {sql_bool(is_indefinite)}, {sql_bool(is_admin_only)}, "
                f"{sql_bool(is_unlisted)}, {sql_array(tags)}, {sql_str(title)}, {sql_str(content)}, {sql_str(slug)}, {sql_int(broadcast_count)})"
            )

        if inserts:
            self.sql_lines.append(
                "-- ── announcements ──────────────────────────────────────────"
            )
            self.sql_lines.append(
                "INSERT INTO announcements (id, creator_id, created_at, start_date, expiry_date, is_indefinite, is_admin_only, is_unlisted, tags, title, content, slug, broadcast_count)\n"
                "VALUES\n  " + ",\n  ".join(inserts) + "\n"
                "ON CONFLICT (id) DO NOTHING;\n"
            )

    def process_achievements(self) -> None:
        path = find_csv(self.csv_dir, ["achievements", "achievement"])
        if not path:
            return
        rows = read_csv_rows(path)
        if rows and "id" in rows[0][0].lower():
            rows = rows[1:]

        inserts = []
        for r in rows:
            if not r:
                continue
            raw_id = r[0] if len(r) > 0 and r[0] else None
            creator_id = self.resolve_user_id(r[1]) if len(r) > 1 else None
            name = r[2] if len(r) > 2 and r[2] else None
            desc = r[3] if len(r) > 3 and r[3] else None
            icon = r[4] if len(r) > 4 and r[4] else None
            extra_url = r[5] if len(r) > 5 and r[5] else None
            term = r[6] if len(r) > 6 and r[6] else None
            points = parse_int(r[7], default=0) if len(r) > 7 else 0
            points = max(points, 0)

            uid = None
            if raw_id:
                try:
                    uid = str(uuid.UUID(raw_id.strip()))
                except ValueError:
                    uid = None
            if not uid:
                uid = str(uuid.uuid4())

            self.known_achievement_ids.add(uid)

            inserts.append(
                f"({sql_uuid(uid)}, {sql_uuid(creator_id)}, {sql_str(name)}, {sql_str(desc)}, {sql_str(icon)}, "
                f"{sql_str(extra_url)}, {sql_str(term)}, {sql_int(points)})"
            )

        if inserts:
            self.sql_lines.append(
                "-- ── achievements ───────────────────────────────────────────"
            )
            self.sql_lines.append(
                "INSERT INTO achievements (id, creator_id, name, description, icon, extra_url, term, points)\n"
                "VALUES\n  " + ",\n  ".join(inserts) + "\n"
                "ON CONFLICT (id) DO NOTHING;\n"
            )

    def process_achievement_records(self) -> None:
        path = find_csv(self.csv_dir, ["achievement_records", "achievement_record"])
        if not path:
            return
        rows = read_csv_rows(path)
        if rows and "id" in rows[0][0].lower():
            rows = rows[1:]

        inserts = []
        for r in rows:
            if not r:
                continue
            raw_id = r[0] if len(r) > 0 and r[0] else None
            recorder_id = self.resolve_user_id(r[1]) if len(r) > 1 else None
            account_id = self.resolve_user_id(r[2]) if len(r) > 2 else None
            date_val = parse_date(r[3]) if len(r) > 3 else None
            ach_id_raw = r[4].strip() if len(r) > 4 and r[4] else None
            term = r[5] if len(r) > 5 and r[5] else None

            if not ach_id_raw or ach_id_raw not in self.known_achievement_ids:
                # Cannot insert foreign key without parent achievement
                continue

            uid = None
            if raw_id:
                try:
                    uid = str(uuid.UUID(raw_id.strip()))
                except ValueError:
                    uid = None
            if not uid:
                uid = str(uuid.uuid4())

            inserts.append(
                f"({sql_uuid(uid)}, {sql_uuid(recorder_id)}, {sql_uuid(account_id)}, "
                f"{sql_str(date_val) if date_val else 'CURRENT_DATE'}, {sql_uuid(ach_id_raw)}, {sql_str(term)})"
            )

        if inserts:
            self.sql_lines.append(
                "-- ── achievement_records ────────────────────────────────────"
            )
            self.sql_lines.append(
                "INSERT INTO achievement_records (id, recorder_id, account_id, date, achievement_id, term)\n"
                "VALUES\n  " + ",\n  ".join(inserts) + "\n"
                "ON CONFLICT (id) DO NOTHING;\n"
            )

    def process_journal(self) -> None:
        path = find_csv(self.csv_dir, ["journal_general", "journal"])
        if not path:
            return
        rows = read_csv_rows(path)
        if rows and ("date" in rows[0][0].lower() or "creator" in rows[0][1].lower()):
            rows = rows[1:]

        inserts = []
        for r in rows:
            if not r:
                continue
            date_val = parse_date(r[0]) if len(r) > 0 else None
            creator_raw = r[1] if len(r) > 1 and r[1] else None
            account_raw = r[2] if len(r) > 2 and r[2] else None
            water = parse_numeric(r[3], 0.0) if len(r) > 3 else 0.0
            assoc = parse_numeric(r[4], 0.0) if len(r) > 4 else 0.0
            misc = parse_numeric(r[5], 0.0) if len(r) > 5 else 0.0
            mop = r[6] if len(r) > 6 and r[6] else None
            period = r[7] if len(r) > 7 and r[7] else None
            entry_type = r[8] if len(r) > 8 and r[8] else None
            notes = r[9] if len(r) > 9 and r[9] else None
            notes_priv = r[10] if len(r) > 10 and r[10] else None
            mop_ref_no = r[11] if len(r) > 11 and r[11] else None
            pr_date_issued = parse_date(r[12]) if len(r) > 12 else None
            pr_ref_no = r[13] if len(r) > 13 and r[13] else None
            # col 14: creator_name, col 15: name, col 16: stno
            was_audited = parse_bool(r[17], default=False) if len(r) > 17 else False
            receipt_url = r[18] if len(r) > 18 and r[18] else None

            raw_id = r[19] if len(r) > 19 and r[19] else None
            explicit_creator_id = r[20] if len(r) > 20 and r[20] else None
            explicit_account_id = r[21] if len(r) > 21 and r[21] else None

            creator_id = self.resolve_user_id(
                explicit_creator_id
            ) or self.resolve_user_id(creator_raw)
            account_id = self.resolve_user_id(
                explicit_account_id
            ) or self.resolve_user_id(account_raw)

            uid = None
            if raw_id:
                try:
                    uid = str(uuid.UUID(raw_id.strip()))
                except ValueError:
                    uid = None
            if not uid:
                uid = str(uuid.uuid4())

            inserts.append(
                f"({sql_uuid(uid)}, {sql_str(date_val) if date_val else 'CURRENT_DATE'}, {sql_uuid(creator_id)}, "
                f"{sql_uuid(account_id)}, {sql_num(water)}, {sql_num(assoc)}, {sql_num(misc)}, {sql_str(mop)}, "
                f"{sql_str(period)}, {sql_str(entry_type)}, {sql_str(notes)}, {sql_str(notes_priv)}, "
                f"{sql_str(mop_ref_no)}, {sql_str(pr_date_issued)}, {sql_str(pr_ref_no)}, {sql_bool(was_audited)}, {sql_str(receipt_url)})"
            )

        if inserts:
            self.sql_lines.append(
                "-- ── journal ────────────────────────────────────────────────"
            )
            self.sql_lines.append(
                "INSERT INTO journal (id, date, creator_id, account_id, water, assoc, misc, mop, period, type, notes, notes_private, mop_ref_no, pr_date_issued, pr_ref_no, was_audited, receipt_url)\n"
                "VALUES\n  " + ",\n  ".join(inserts) + "\n"
                "ON CONFLICT (id) DO NOTHING;\n"
            )

    def process_laundry(self) -> None:
        path = find_csv(self.csv_dir, ["laundry"])
        if not path:
            return
        rows = read_csv_rows(path)
        if rows and "id" in rows[0][0].lower():
            rows = rows[1:]

        inserts = []
        for r in rows:
            if not r:
                continue
            raw_id = r[0] if len(r) > 0 and r[0] else None
            res_id = self.resolve_user_id(r[1]) if len(r) > 1 else None
            date_val = parse_date(r[2]) if len(r) > 2 else None
            if not date_val:
                continue
            time_start = r[3].strip() if len(r) > 3 and r[3] else ""
            time_end = r[4].strip() if len(r) > 4 and r[4] else ""
            raw_status = r[5].strip().upper() if len(r) > 5 and r[5] else "ACTIVE"
            status = raw_status if raw_status in ("ACTIVE", "CANCELLED") else "ACTIVE"
            cancel_reason = r[6] if len(r) > 6 and r[6] else None
            creation_ts = parse_timestamp(r[7]) if len(r) > 7 else None
            cancel_ts = parse_timestamp(r[8]) if len(r) > 8 else None

            # Constraint checks:
            # (status = 'CANCELLED') = (cancelled_at IS NOT NULL)
            # cancel_reason IS NULL OR status = 'CANCELLED'
            if status == "CANCELLED":
                if not cancel_ts:
                    cancel_ts = creation_ts or "NOW()"
            else:
                cancel_ts = None
                cancel_reason = None

            uid = None
            if raw_id:
                try:
                    uid = str(uuid.UUID(raw_id.strip()))
                except ValueError:
                    uid = None
            if not uid:
                uid = str(uuid.uuid4())

            created_expr = sql_str(creation_ts) if creation_ts else "NOW()"
            cancelled_expr = (
                sql_str(cancel_ts)
                if cancel_ts and cancel_ts != "NOW()"
                else ("NOW()" if cancel_ts else "NULL")
            )

            inserts.append(
                f"({sql_uuid(uid)}, {sql_uuid(res_id)}, {sql_str(date_val)}, {sql_str(time_start)}, {sql_str(time_end)}, "
                f"{sql_str(status)}, {sql_str(cancel_reason)}, {created_expr}, {cancelled_expr})"
            )

        if inserts:
            self.sql_lines.append(
                "-- ── laundry ────────────────────────────────────────────────"
            )
            self.sql_lines.append(
                "INSERT INTO laundry (id, resident_id, date, time_start, time_end, status, cancel_reason, created_at, cancelled_at)\n"
                "VALUES\n  " + ",\n  ".join(inserts) + "\n"
                "ON CONFLICT (id) DO NOTHING;\n"
            )

    def process_payment_requests(self) -> None:
        path = find_csv(self.csv_dir, ["payment_requests", "payment_request"])
        if not path:
            return
        rows = read_csv_rows(path)
        if rows and "id" in rows[0][0].lower():
            rows = rows[1:]

        inserts = []
        for r in rows:
            if not r:
                continue
            raw_id = r[0] if len(r) > 0 and r[0] else None
            res_id = self.resolve_user_id(r[1]) if len(r) > 1 else None
            date_val = parse_date(r[2]) if len(r) > 2 else None
            water = max(0.0, parse_numeric(r[3], 0.0) if len(r) > 3 else 0.0)
            assoc = max(0.0, parse_numeric(r[4], 0.0) if len(r) > 4 else 0.0)
            misc = max(0.0, parse_numeric(r[5], 0.0) if len(r) > 5 else 0.0)
            mop = r[6] if len(r) > 6 and r[6] else None
            req_type = r[7] if len(r) > 7 and r[7] else None
            proof_link = r[8] if len(r) > 8 and r[8] else None
            raw_status = r[9].strip().upper() if len(r) > 9 and r[9] else "PENDING"
            if raw_status not in ("PENDING", "APPROVED", "DECLINED", "CANCELLED"):
                raw_status = "PENDING"
            notes = r[10] if len(r) > 10 and r[10] else None
            status_reason = r[11] if len(r) > 11 and r[11] else None

            uid = None
            if raw_id:
                try:
                    uid = str(uuid.UUID(raw_id.strip()))
                except ValueError:
                    uid = None
            if not uid:
                uid = str(uuid.uuid4())

            inserts.append(
                f"({sql_uuid(uid)}, {sql_uuid(res_id)}, {sql_str(date_val) if date_val else 'CURRENT_DATE'}, "
                f"{sql_num(water)}, {sql_num(assoc)}, {sql_num(misc)}, {sql_str(mop)}, {sql_str(req_type)}, "
                f"{sql_str(proof_link)}, {sql_str(raw_status)}, {sql_str(notes)}, {sql_str(status_reason)})"
            )

        if inserts:
            self.sql_lines.append(
                "-- ── payment_requests ───────────────────────────────────────"
            )
            self.sql_lines.append(
                "INSERT INTO payment_requests (id, resident_id, date, water_fee, assoc_fee, misc, mop, type, proof_link, status, notes, status_reason)\n"
                "VALUES\n  " + ",\n  ".join(inserts) + "\n"
                "ON CONFLICT (id) DO NOTHING;\n"
            )

    def process_static_ip(self) -> None:
        path = find_csv(self.csv_dir, ["static_ip", "static_ips", "network_static"])
        if not path:
            return
        rows = read_csv_rows(path)
        if rows and "id" in rows[0][0].lower():
            rows = rows[1:]

        inserts = []
        seen_keys = set()
        for r in rows:
            if not r:
                continue
            raw_id = r[0] if len(r) > 0 and r[0] else None
            recorder_id = self.resolve_user_id(r[1]) if len(r) > 1 else None
            res_id = self.resolve_user_id(r[2]) if len(r) > 2 else None
            if not res_id:
                continue
            period = r[3].strip() if len(r) > 3 and r[3] else None
            raw_type = r[4].strip().upper() if len(r) > 4 and r[4] else "LAN"
            if raw_type not in ("LAN", "OUTDOOR", "PERMANENT"):
                raw_type = "LAN"
            ip = r[5].strip() if len(r) > 5 and r[5] else None
            notes = r[6] if len(r) > 6 and r[6] else None

            if not ip or not period:
                continue

            pair = (ip, period)
            if pair in seen_keys:
                continue
            seen_keys.add(pair)

            uid = None
            if raw_id:
                try:
                    uid = str(uuid.UUID(raw_id.strip()))
                except ValueError:
                    uid = None
            if not uid:
                uid = str(uuid.uuid4())

            inserts.append(
                f"({sql_uuid(uid)}, {sql_uuid(recorder_id)}, {sql_uuid(res_id)}, {sql_str(period)}, "
                f"{sql_str(raw_type)}, {sql_str(ip)}, {sql_str(notes)})"
            )

        if inserts:
            self.sql_lines.append(
                "-- ── static_ip ──────────────────────────────────────────────"
            )
            self.sql_lines.append(
                "INSERT INTO static_ip (id, recorder_id, resident_id, period, type, ip, notes)\n"
                "VALUES\n  " + ",\n  ".join(inserts) + "\n"
                "ON CONFLICT (ip, period) DO NOTHING;\n"
            )

    def generate(self) -> str:
        self.sql_lines.append(
            "-- ============================================================"
        )
        self.sql_lines.append("-- Google Sheets CSV Migration Dump")
        self.sql_lines.append(f"-- Generated At: {datetime.now().isoformat()}")
        self.sql_lines.append(
            "-- ============================================================\n"
        )
        self.sql_lines.append("BEGIN;\n")

        # Dependency order execution
        self.process_users()
        self.process_officers()
        self.process_constants()
        self.process_accounts()
        self.process_settings()
        self.process_announcements()
        self.process_achievements()
        self.process_achievement_records()
        self.process_journal()
        self.process_laundry()
        self.process_payment_requests()
        self.process_static_ip()

        self.sql_lines.append("COMMIT;\n")
        return "\n".join(self.sql_lines)


def main():
    parser = argparse.ArgumentParser(
        description="Convert Google Sheets CSV exports into Supabase SQL."
    )
    parser.add_argument(
        "--csv-dir", required=True, help="Directory containing CSV exports"
    )
    parser.add_argument(
        "--output", default="migration.sql", help="Output SQL file path"
    )
    args = parser.parse_args()

    csv_dir = os.path.abspath(args.csv_dir)
    if not os.path.isdir(csv_dir):
        print(f"Error: {csv_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    builder = MigrationBuilder(csv_dir)
    sql_content = builder.generate()

    with open(args.output, "w", encoding="utf-8") as f:
        f.write(sql_content)

    print(f"Generated SQL migration written to {args.output}")


if __name__ == "__main__":
    main()
