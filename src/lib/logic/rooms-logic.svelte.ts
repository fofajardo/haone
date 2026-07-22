import { uiSettings } from "$lib/state/settings.svelte";
import {
  fetchSheetRowsRaw,
  updateSheetValue,
  batchUpdateValues,
  appendSheetRow,
  deleteSheetRow
} from "$lib/services/google-sheets-service";
import {
  ACCOUNT_COL,
  CURR_COL,
  JOURNAL_COL,
  STATIC_IP_COL,
  AccountType,
  UserTag,
  type UserRecord
} from "$lib/schemas";
import { fetchUsers, addUser, updateUser, fetchResidents } from "$lib/logic/resident-logic";
import { roomsState } from "$lib/state/rooms.svelte";
import { auth } from "$lib/state/auth.svelte";

export interface CurrRecord {
  timestamp: string;
  email: string;
  room: string;
  bed: string;
  lastName: string;
  firstName: string;
  college: string;
  program: string;
  studentNo: string;
  checkInDate: string;
  isEvaluated: boolean;
  term: string;
  accountType: string;
  suffix?: string;
  overrideName?: string;
  rowIndex: number; // 1-indexed
  raw: string[];
}

export interface SyncPreviewAction {
  type: "CREATE_USER" | "UPDATE_USER" | "CREATE_ACCOUNT" | "UPDATE_ACCOUNT" | "EVALUATE_ONLY";
  residentName: string;
  email: string;
  studentNo: string;
  details: string;
  warning?: string;
  from?: string;
  to?: string;
  currIndex?: number; // Row index in CURR sheet to mark as evaluated
  // Payload for applying
  payload: any;
}

export async function fetchCurrSheet(forceRefresh = false): Promise<CurrRecord[]> {
  if (!uiSettings.residentRecordsId) return [];

  const rows = await fetchSheetRowsRaw(uiSettings.residentRecordsId, "CURR!A:O", forceRefresh);
  if (rows.length <= 1) return [];

  return rows.slice(1).map((row, idx) => ({
    timestamp: row[CURR_COL.TIMESTAMP] || "",
    email: (row[CURR_COL.EMAIL] || "").trim().toLowerCase(),
    room: (row[CURR_COL.ROOM] || "").trim().toUpperCase(),
    bed: (row[CURR_COL.BED] || "").trim().toUpperCase(),
    lastName: (row[CURR_COL.LAST_NAME] || "").trim(),
    firstName: (row[CURR_COL.FIRST_NAME] || "").trim(),
    college: (row[CURR_COL.COLLEGE] || "").trim(),
    program: (row[CURR_COL.PROGRAM] || "").trim(),
    studentNo: (row[CURR_COL.STUDENT_NO] || "").trim(),
    checkInDate: row[CURR_COL.CHECK_IN_DATE] || "",
    isEvaluated: (row[CURR_COL.EVALUATED] || "").toUpperCase() === "TRUE",
    term: row[CURR_COL.TERM] || "",
    accountType: (row[CURR_COL.ACCOUNT_TYPE] || "").trim().toUpperCase(),
    suffix: row[CURR_COL.SUFFIX] || "",
    overrideName: row[CURR_COL.OVERRIDE_NAME] || "",
    rowIndex: idx + 2, // +1 for header, +1 for 1-indexing
    raw: row
  }));
}

export async function getSyncPreview(currentTerm: string): Promise<SyncPreviewAction[]> {
  if (!uiSettings.accountingWorkbookId || !uiSettings.residentRecordsId) {
    throw new Error("Spreadsheet IDs not configured");
  }

  const [currRecords, users, accRows] = await Promise.all([
    fetchCurrSheet(true),
    fetchUsers(true),
    fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:L", true)
  ]);

  const userMapByStNo = new Map<string, UserRecord>();
  const userMapByEmail = new Map<string, UserRecord>();
  users.forEach((u) => {
    if (u.studentNo) userMapByStNo.set(u.studentNo, u);
    if (u.email) userMapByEmail.set(u.email.toLowerCase(), u);
  });

  // Map: residentId -> accountRow
  const existingAccountMap = new Map<string, { row: string[]; index: number }>();
  // Map: room-bed -> residentName
  const currentOccupancyMap = new Map<string, string>();

  accRows.slice(1).forEach((row, idx) => {
    if (row[ACCOUNT_COL.PERIOD] === currentTerm) {
      existingAccountMap.set(row[ACCOUNT_COL.RESIDENT_ID], { row, index: idx + 2 });

      if (row[ACCOUNT_COL.ROOM] && row[ACCOUNT_COL.BED]) {
        const userId = row[ACCOUNT_COL.RESIDENT_ID];
        const user = users.find((u) => u.id === userId);
        const name = user ? `${user.lastName}, ${user.firstName}` : "Unknown";
        currentOccupancyMap.set(`${row[ACCOUNT_COL.ROOM]}-${row[ACCOUNT_COL.BED]}`, name);
      }
    }
  });

  const plannedOccupancyMap = new Map<string, string>();
  const actions: SyncPreviewAction[] = [];
  // For tracking users planned to be created in this preview session
  const plannedUsersByStNo = new Map<string, string>();
  const plannedUsersByEmail = new Map<string, string>();

  for (const curr of currRecords) {
    if (curr.isEvaluated) continue;
    if (curr.term !== currentTerm) continue;
    if (!curr.studentNo && !curr.email) continue;

    let user = userMapByStNo.get(curr.studentNo) || userMapByEmail.get(curr.email);
    let userId = user?.id;
    let residentName = user
      ? `${user.lastName.toUpperCase()}, ${user.firstName.toUpperCase()}`
      : `${curr.lastName.toUpperCase()}, ${curr.firstName.toUpperCase()}`;

    const isEmptyRoomBed =
      !curr.room ||
      !curr.bed ||
      curr.room === "NONE" ||
      curr.bed === "NONE" ||
      curr.room === "N/A" ||
      curr.bed === "N/A";

    // Check if target room is valid/available
    const targetRoom = roomsState.config.find((r) => r.room_number === curr.room);
    let warning = "";
    if (!isEmptyRoomBed) {
      if (!targetRoom) {
        warning = `Room ${curr.room} not found in configuration.`;
      } else if (targetRoom.unavailable_reason) {
        warning = `Room ${curr.room} is marked as unavailable: ${targetRoom.unavailable_reason}`;
      } else if (curr.room && curr.bed) {
        const loc = `${curr.room}-${curr.bed}`;
        const occupant = currentOccupancyMap.get(loc);
        if (occupant && occupant !== residentName) {
          warning = `Bed ${loc} is currently occupied by ${occupant} in ${currentTerm}.`;
        } else if (plannedOccupancyMap.has(loc)) {
          warning = `Bed ${loc} is already assigned to ${plannedOccupancyMap.get(loc)} in this sync.`;
        } else {
          plannedOccupancyMap.set(loc, residentName);
        }
      }
    }

    if (!user) {
      // Check if we already planned to create this user
      let userId = plannedUsersByStNo.get(curr.studentNo) || plannedUsersByEmail.get(curr.email);

      if (!userId) {
        userId = crypto.randomUUID();
        plannedUsersByStNo.set(curr.studentNo, userId);
        plannedUsersByEmail.set(curr.email, userId);

        // Translate account type to user tag.
        // XXX: keep this in sync with schemas.ts. This should probably be put
        // somewhere else to avoid duplication.
        let accountTypeTag = UserTag.STUDENT;
        switch (curr.accountType) {
          case AccountType.STUDENT:
            accountTypeTag = UserTag.STUDENT;
            break;
          case AccountType.TRANSIENT:
            accountTypeTag = UserTag.GUEST;
            break;
          case AccountType.BOOTCAMP:
            accountTypeTag = UserTag.BOOTCAMP;
            break;
          case AccountType.ALUMNUS:
            accountTypeTag = UserTag.ALUMNUS;
            break;
          case AccountType.FACULTY:
            accountTypeTag = UserTag.FACULTY;
            break;
          case AccountType.STAFF:
            accountTypeTag = UserTag.STAFF;
            break;
          case AccountType.REPS:
            accountTypeTag = UserTag.REPS;
            break;
          default:
            throw new Error(`Unknown account type: ${curr.accountType} for ${residentName}`);
        }

        actions.push({
          type: "CREATE_USER",
          residentName,
          email: curr.email,
          studentNo: curr.studentNo,
          currIndex: curr.rowIndex,
          details: `Create profile for ${curr.lastName.toUpperCase()}, ${curr.firstName.toUpperCase()}`,
          payload: {
            id: userId,
            email: curr.email,
            studentNo: curr.studentNo,
            college: curr.college,
            program: curr.program,
            firstName: curr.firstName.toUpperCase(),
            lastName: curr.lastName.toUpperCase(),
            tags: accountTypeTag,
            suffix: curr.suffix || "",
            overrideName: curr.overrideName || ""
          }
        });
      }

      if (isEmptyRoomBed) {
        actions.push({
          type: "EVALUATE_ONLY",
          residentName,
          email: curr.email,
          studentNo: curr.studentNo,
          currIndex: curr.rowIndex,
          details: `Complete registration (No Room/Bed Assigned)`,
          to: "No Room/Bed Assigned",
          payload: null
        });
      } else {
        // Always create account for new user found in CURR
        actions.push({
          type: "CREATE_ACCOUNT",
          residentName,
          email: curr.email,
          studentNo: curr.studentNo,
          currIndex: curr.rowIndex,
          details: `Assign to`,
          to: `${curr.room}-${curr.bed}`,
          warning,
          payload: {
            residentId: userId,
            period: currentTerm,
            room: curr.room,
            bed: curr.bed,
            checkInDate: curr.checkInDate,
            accountType: curr.accountType || AccountType.STUDENT
          }
        });
      }
    } else {
      // User exists, check for updates or bed assignments
      const colleges = (user.college || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const programs = (user.program || "")
        .split(":")
        .map((p) => p.trim())
        .filter(Boolean);

      const lastCollege = colleges[colleges.length - 1] || "";
      const lastProgram = programs[programs.length - 1] || "";

      const needsUpdate =
        curr.college !== lastCollege ||
        curr.program !== lastProgram ||
        (curr.suffix !== undefined && curr.suffix !== (user.suffix || "")) ||
        (curr.overrideName !== undefined && curr.overrideName !== (user.overrideName || ""));
      if (needsUpdate) {
        const newColleges = curr.college !== lastCollege ? [...colleges, curr.college] : colleges;
        const newPrograms = curr.program !== lastProgram ? [...programs, curr.program] : programs;

        actions.push({
          type: "UPDATE_USER",
          residentName,
          email: user.email,
          studentNo: user.studentNo,
          currIndex: curr.rowIndex,
          details: `Update profile`,
          payload: {
            id: user.id,
            college: newColleges.join(","),
            program: newPrograms.join(":"),
            suffix: curr.suffix || "",
            overrideName: curr.overrideName || ""
          }
        });
      }

      // Check account update
      const existingAcc = existingAccountMap.get(user.id);
      if (existingAcc) {
        if (
          !isEmptyRoomBed &&
          (existingAcc.row[ACCOUNT_COL.ROOM] !== curr.room ||
            existingAcc.row[ACCOUNT_COL.BED] !== curr.bed)
        ) {
          const oldRoom = existingAcc.row[ACCOUNT_COL.ROOM];
          const oldBed = existingAcc.row[ACCOUNT_COL.BED];
          const oldLoc = oldRoom && oldBed ? `${oldRoom}-${oldBed}` : "Unassigned";

          actions.push({
            type: "UPDATE_ACCOUNT",
            residentName,
            email: user.email,
            studentNo: user.studentNo,
            currIndex: curr.rowIndex,
            details: `Change bed`,
            from: oldLoc,
            to: `${curr.room}-${curr.bed}`,
            warning,
            payload: {
              rowIndex: existingAcc.index,
              room: curr.room,
              bed: curr.bed,
              checkInDate: curr.checkInDate
            }
          });
        }
      } else {
        if (isEmptyRoomBed) {
          const hasUserAction = actions.some((a) => a.currIndex === curr.rowIndex);
          if (!hasUserAction) {
            actions.push({
              type: "EVALUATE_ONLY",
              residentName,
              email: user.email,
              studentNo: user.studentNo,
              currIndex: curr.rowIndex,
              details: `Complete registration (No Room/Bed Assigned)`,
              to: "No Room/Bed Assigned",
              payload: null
            });
          }
        } else {
          actions.push({
            type: "CREATE_ACCOUNT",
            residentName,
            email: user.email,
            studentNo: user.studentNo,
            currIndex: curr.rowIndex,
            details: `New assignment`,
            to: `${curr.room}-${curr.bed}`,
            warning,
            payload: {
              residentId: user.id,
              period: currentTerm,
              room: curr.room,
              bed: curr.bed,
              checkInDate: curr.checkInDate,
              accountType: curr.accountType || AccountType.STUDENT
            }
          });
        }
      }
    }
  }

  return actions;
}

export async function applySync(actions: SyncPreviewAction[]) {
  if (!uiSettings.accountingWorkbookId) throw new Error("Accounting Workbook ID not configured");

  const userCreations = actions.filter((a) => a.type === "CREATE_USER");
  const userUpdates = actions.filter((a) => a.type === "UPDATE_USER");
  const accountUpdates = actions.filter((a) => a.type === "UPDATE_ACCOUNT");
  const accountCreations = actions.filter((a) => a.type === "CREATE_ACCOUNT");

  // 1. Create Users
  for (const action of userCreations) {
    await addUser(action.payload);
  }

  // 2. Update Users
  for (const action of userUpdates) {
    const { id, ...data } = action.payload;
    await updateUser(id, data);
  }

  // 3. Update Accounts (Batch)
  if (accountUpdates.length > 0) {
    const updates: any[] = [];
    for (const a of accountUpdates) {
      const actualRow = a.payload.rowIndex;
      updates.push({
        range: `accounts!D${actualRow}:E${actualRow}`,
        values: [[a.payload.room, a.payload.bed]]
      });
      // Also update check-in date
      updates.push({
        range: `accounts!K${actualRow}`,
        values: [[a.payload.checkInDate]]
      });
    }
    await batchUpdateValues(uiSettings.accountingWorkbookId, updates);
  }

  // 4. Create Accounts (Append)
  if (accountCreations.length > 0) {
    const rows = accountCreations.map((a) => {
      const row = new Array(12).fill("");
      row[ACCOUNT_COL.ID] = crypto.randomUUID();
      row[ACCOUNT_COL.RESIDENT_ID] = a.payload.residentId;
      row[ACCOUNT_COL.PERIOD] = a.payload.period;
      row[ACCOUNT_COL.ROOM] = a.payload.room;
      row[ACCOUNT_COL.BED] = a.payload.bed;
      row[ACCOUNT_COL.CHECK_IN_DATE] = a.payload.checkInDate;
      row[ACCOUNT_COL.TYPE] = a.payload.accountType || AccountType.STUDENT;
      return row;
    });
    await appendSheetRow(uiSettings.accountingWorkbookId, "accounts!A:L", rows);

    // Carry forward any prior term static IP addresses
    if (uiSettings.sharedRecordsId) {
      try {
        const staticIpRows = await fetchSheetRowsRaw(uiSettings.sharedRecordsId, "static_ip!A:G");
        const carryForwardRows: any[][] = [];

        for (const a of accountCreations) {
          const rid = a.payload.residentId;
          const targetPeriod = a.payload.period;

          const priorRows = staticIpRows.slice(1).filter((r) => {
            return r[STATIC_IP_COL.RESIDENT_ID] === rid && r[STATIC_IP_COL.PERIOD] !== targetPeriod;
          });

          if (priorRows.length > 0) {
            const sortedPeriods = [
              ...new Set(
                priorRows.map((r) => {
                  return r[STATIC_IP_COL.PERIOD];
                })
              )
            ].sort((p1, p2) => {
              return p2.localeCompare(p1);
            });
            const latestPeriod = sortedPeriods[0];
            const latestEntries = priorRows.filter((r) => {
              return r[STATIC_IP_COL.PERIOD] === latestPeriod;
            });

            for (const entry of latestEntries) {
              const newRow = new Array(7).fill("");
              newRow[STATIC_IP_COL.ID] = crypto.randomUUID();
              newRow[STATIC_IP_COL.RECORDER_ID] =
                entry[STATIC_IP_COL.RECORDER_ID] || auth.user?.email || "";
              newRow[STATIC_IP_COL.RESIDENT_ID] = rid;
              newRow[STATIC_IP_COL.PERIOD] = targetPeriod;
              newRow[STATIC_IP_COL.TYPE] = entry[STATIC_IP_COL.TYPE] || "";
              newRow[STATIC_IP_COL.IP] = entry[STATIC_IP_COL.IP] || "";
              newRow[STATIC_IP_COL.NOTES] = entry[STATIC_IP_COL.NOTES] || "";
              carryForwardRows.push(newRow);
            }
          }
        }

        if (carryForwardRows.length > 0) {
          await appendSheetRow(uiSettings.sharedRecordsId, "static_ip!A:G", carryForwardRows);
        }
      } catch (e) {
        console.error("Failed to carry forward static IPs in applySync:", e);
      }
    }
  }

  // 5. Mark CURR as Evaluated
  const currIndices = [...new Set(actions.map((a) => a.currIndex).filter(Boolean))];
  if (currIndices.length > 0 && uiSettings.residentRecordsId) {
    // EVALUATED is col index 10 = column K
    const updates = currIndices.map((idx) => ({
      range: `CURR!K${idx}`,
      values: [["TRUE"]]
    }));
    await batchUpdateValues(uiSettings.residentRecordsId, updates);
  }

  return {
    usersCreated: userCreations.length,
    usersUpdated: userUpdates.length,
    accountsCreated: accountCreations.length,
    accountsUpdated: accountUpdates.length,
    evaluated: currIndices.length
  };
}

export async function manualAssignBed(residentId: string, room: string, bed: string, term: string) {
  if (!uiSettings.accountingWorkbookId) {
    throw new Error("Accounting Workbook ID not configured");
  }

  const accRows = await fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:L");
  const rowIndex = accRows.findIndex((r) => {
    return r[ACCOUNT_COL.RESIDENT_ID] === residentId && r[ACCOUNT_COL.PERIOD] === term;
  });

  if (rowIndex !== -1) {
    const actualRow = rowIndex + 1;
    await updateSheetValue(
      uiSettings.accountingWorkbookId,
      `accounts!D${actualRow}:E${actualRow}`,
      [[room, bed]]
    );
  } else {
    const newRow = new Array(12).fill("");
    newRow[ACCOUNT_COL.ID] = crypto.randomUUID();
    newRow[ACCOUNT_COL.RESIDENT_ID] = residentId;
    newRow[ACCOUNT_COL.PERIOD] = term;
    newRow[ACCOUNT_COL.ROOM] = room;
    newRow[ACCOUNT_COL.BED] = bed;
    await appendSheetRow(uiSettings.accountingWorkbookId, "accounts!A:L", [newRow]);

    // Carry forward any prior term static IP addresses
    if (uiSettings.sharedRecordsId) {
      try {
        const staticIpRows = await fetchSheetRowsRaw(uiSettings.sharedRecordsId, "static_ip!A:G");
        const priorRows = staticIpRows.slice(1).filter((r) => {
          return r[STATIC_IP_COL.RESIDENT_ID] === residentId && r[STATIC_IP_COL.PERIOD] !== term;
        });

        if (priorRows.length > 0) {
          const sortedPeriods = [
            ...new Set(
              priorRows.map((r) => {
                return r[STATIC_IP_COL.PERIOD];
              })
            )
          ].sort((p1, p2) => {
            return p2.localeCompare(p1);
          });
          const latestPeriod = sortedPeriods[0];
          const latestEntries = priorRows.filter((r) => {
            return r[STATIC_IP_COL.PERIOD] === latestPeriod;
          });

          const carryForwardRows = latestEntries.map((entry) => {
            const newIpRow = new Array(7).fill("");
            newIpRow[STATIC_IP_COL.ID] = crypto.randomUUID();
            newIpRow[STATIC_IP_COL.RECORDER_ID] =
              entry[STATIC_IP_COL.RECORDER_ID] || auth.user?.email || "";
            newIpRow[STATIC_IP_COL.RESIDENT_ID] = residentId;
            newIpRow[STATIC_IP_COL.PERIOD] = term;
            newIpRow[STATIC_IP_COL.TYPE] = entry[STATIC_IP_COL.TYPE] || "";
            newIpRow[STATIC_IP_COL.IP] = entry[STATIC_IP_COL.IP] || "";
            newIpRow[STATIC_IP_COL.NOTES] = entry[STATIC_IP_COL.NOTES] || "";
            return newIpRow;
          });

          if (carryForwardRows.length > 0) {
            await appendSheetRow(uiSettings.sharedRecordsId, "static_ip!A:G", carryForwardRows);
          }
        }
      } catch (e) {
        console.error("Failed to carry forward static IPs in manualAssignBed:", e);
      }
    }
  }
}

export async function manualDelistResident(
  residentId: string,
  term: string,
  reason: "remove" | "early_checkout" | "transferred" | "deceased" | "loa",
  waiveBalance = false
) {
  if (!uiSettings.accountingWorkbookId) {
    throw new Error("Accounting Workbook ID not configured");
  }

  const accRows = await fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:L");
  const rowIndex = accRows.findIndex((r) => {
    return r[ACCOUNT_COL.RESIDENT_ID] === residentId && r[ACCOUNT_COL.PERIOD] === term;
  });

  if (rowIndex === -1) {
    throw new Error("Active account entry for resident not found in this term.");
  }

  if (reason === "remove") {
    // 1. Remove account completely (deletes the account row for this user)
    await deleteSheetRow(uiSettings.accountingWorkbookId, "accounts", rowIndex);
  } else {
    // 2. Early check-out / 3. Transferred to another residence hall / 4. Deceased / 5. Leave of Absence
    const actualRow = rowIndex + 1;
    const currentBed = (accRows[rowIndex][ACCOUNT_COL.BED] || "").trim();

    let reasonText = "";
    if (reason === "early_checkout") {
      reasonText = "Early checkout";
    } else if (reason === "transferred") {
      reasonText = "Transferred to another residence hall";
    } else if (reason === "deceased") {
      reasonText = "Deceased";
      await updateUser(residentId, { tags: UserTag.DECEASED });
    } else if (reason === "loa") {
      reasonText = "Leave of Absence";
    }

    const updatedBed = `${currentBed} (${reasonText})`;
    await updateSheetValue(uiSettings.accountingWorkbookId, `accounts!E${actualRow}`, [
      [updatedBed]
    ]);

    if (
      (reason === "early_checkout" ||
        reason === "loa" ||
        reason === "deceased" ||
        reason === "transferred") &&
      waiveBalance
    ) {
      const residents = await fetchResidents(true);
      const resRecord = residents.find((r) => {
        return r.residentId === residentId && r.period === term;
      });
      if (resRecord && resRecord.bal > 0) {
        // Retrieve PMT_WAIVED type from constants sheet
        const constRows = await fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "constants!A:C");
        const getConst = (key: string) => {
          const found = constRows.find((r) => {
            return r[0] === key;
          });
          return found ? found[1] : "0";
        };
        const pmtWaived = getConst("PMT_WAIVED") || "WAIVED";

        let remainingToWaive = resRecord.bal;
        let waterWaiveAmt = 0;
        let assocWaiveAmt = 0;
        let miscWaiveAmt = 0;

        if (resRecord.waterBal > 0) {
          waterWaiveAmt = Math.min(resRecord.waterBal, remainingToWaive);
          remainingToWaive -= waterWaiveAmt;
        }
        if (remainingToWaive > 0 && resRecord.assocBal > 0) {
          assocWaiveAmt = Math.min(resRecord.assocBal, remainingToWaive);
          remainingToWaive -= assocWaiveAmt;
        }
        if (remainingToWaive > 0) {
          miscWaiveAmt = remainingToWaive;
        }

        const dateStr = new Date()
          .toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
          })
          .toUpperCase();
        let noteLabel = "";
        if (reason === "early_checkout") {
          noteLabel = `EARLY CHECKOUT (${dateStr})`;
        } else if (reason === "loa") {
          noteLabel = `LEAVE OF ABSENCE (${dateStr})`;
        } else if (reason === "deceased") {
          noteLabel = `DECEASED (${dateStr})`;
        } else if (reason === "transferred") {
          noteLabel = `TRANSFERRED TO ANOTHER RESIDENCE HALL (${dateStr})`;
        }

        const jRow = new Array(20).fill("");
        jRow[JOURNAL_COL.DATE] = new Date().toISOString().split("T")[0];
        jRow[JOURNAL_COL.CREATOR] = auth.user?.email || "";
        jRow[JOURNAL_COL.ACCOUNT] = resRecord.email;
        jRow[JOURNAL_COL.WATER] = waterWaiveAmt > 0 ? waterWaiveAmt.toString() : "";
        jRow[JOURNAL_COL.ASSOC] = assocWaiveAmt > 0 ? assocWaiveAmt.toString() : "";
        jRow[JOURNAL_COL.MISC] = miscWaiveAmt > 0 ? miscWaiveAmt.toString() : "";
        jRow[JOURNAL_COL.MOP] = "";
        jRow[JOURNAL_COL.PERIOD] = term;
        jRow[JOURNAL_COL.TYPE] = pmtWaived;
        jRow[JOURNAL_COL.NOTES] = noteLabel;
        jRow[JOURNAL_COL.NOTES_PRIVATE] = "";
        jRow[JOURNAL_COL.MOP_REFNO] = "";
        jRow[JOURNAL_COL.PR_DATE_ISSUED] = "";
        jRow[JOURNAL_COL.PR_REFNO] = "";
        jRow[JOURNAL_COL.CREATOR_NAME] = auth.displayName;
        jRow[JOURNAL_COL.NAME] = resRecord.name;
        jRow[JOURNAL_COL.STNO] = resRecord.stno;
        jRow[JOURNAL_COL.WAS_AUDITED] = "FALSE";
        jRow[JOURNAL_COL.RECEIPT_URL] = "";
        jRow[JOURNAL_COL.ID] = crypto.randomUUID();

        await appendSheetRow(uiSettings.accountingWorkbookId, "journal_general!A:T", [jRow]);
      }
    }
  }
}
