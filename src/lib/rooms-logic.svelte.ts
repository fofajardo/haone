import { uiSettings } from "./settings.svelte";
import {
  fetchSheetRowsRaw,
  updateSheetValue,
  batchUpdateValues,
  appendSheetRow
} from "./google-sheets";
import { USER_COL, ACCOUNT_COL, CURR_COL, type UserRecord, type ResidentRecord } from "./schemas";
import { fetchUsers, addUser, updateUser, computeDisplayNames } from "./resident-logic";
import { roomsState } from "./rooms.svelte";

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
  rowIndex: number; // 1-indexed
  raw: string[];
}

export interface SyncPreviewAction {
  type: "CREATE_USER" | "UPDATE_USER" | "CREATE_ACCOUNT" | "UPDATE_ACCOUNT";
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

  const rows = await fetchSheetRowsRaw(uiSettings.residentRecordsId, "CURR!A:K", forceRefresh);
  if (rows.length <= 1) return [];

  return rows.slice(1).map((row, idx) => ({
    timestamp: row[CURR_COL.TIMESTAMP] || "",
    email: (row[CURR_COL.EMAIL] || "").trim().toLowerCase(),
    room: (row[CURR_COL.ROOM] || "").trim().toUpperCase(),
    bed: (row[CURR_COL.BED] || "").trim().toUpperCase(),
    lastName: (row[CURR_COL.LAST_NAME] || "").trim(),
    firstName: (row[CURR_COL.FIRST_NAME] || "").trim(),
    college: (row[CURR_COL.COLLEGE] || "").trim().toUpperCase(),
    program: (row[CURR_COL.PROGRAM] || "").trim().toUpperCase(),
    studentNo: (row[CURR_COL.STUDENT_NO] || "").trim(),
    checkInDate: row[CURR_COL.CHECK_IN_DATE] || "",
    isEvaluated: (row[CURR_COL.EVALUATED] || "").toUpperCase() === "TRUE",
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
    fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:I", true)
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
      existingAccountMap.set(row[ACCOUNT_COL.RESIDENT_ID], { row, index: idx + 1 });

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
    if (!curr.studentNo && !curr.email) continue;

    let user = userMapByStNo.get(curr.studentNo) || userMapByEmail.get(curr.email);
    let userId = user?.id;
    let residentName = user
      ? `${user.lastName.toUpperCase()}, ${user.firstName.toUpperCase()}`
      : `${curr.lastName.toUpperCase()}, ${curr.firstName.toUpperCase()}`;

    // Check if target room is valid/available
    const targetRoom = roomsState.config.find((r) => r.room_number === curr.room);
    let warning = "";
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

    if (!user) {
      // Check if we already planned to create this user
      let userId = plannedUsersByStNo.get(curr.studentNo) || plannedUsersByEmail.get(curr.email);

      if (!userId) {
        userId = crypto.randomUUID();
        plannedUsersByStNo.set(curr.studentNo, userId);
        plannedUsersByEmail.set(curr.email, userId);

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
            tags: "STUDENT"
          }
        });
      }

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
          checkInDate: curr.checkInDate
        }
      });
    } else {
      // User exists, check for updates or bed assignments
      const lastCollege = (user.college || "").split(",").pop()?.trim() || "";
      const lastProgram = (user.program || "").split(":").pop()?.trim() || "";
      const needsUserUpdate = lastCollege !== curr.college || lastProgram !== curr.program;

      if (needsUserUpdate) {
        // Append new academic info if different
        const newCollege =
          lastCollege === curr.college
            ? user.college
            : user.college
              ? `${user.college},${curr.college}`
              : curr.college;
        const newProgram =
          lastProgram === curr.program
            ? user.program
            : user.program
              ? `${user.program}:${curr.program}`
              : curr.program;

        actions.push({
          type: "UPDATE_USER",
          residentName,
          email: user.email,
          studentNo: user.studentNo,
          currIndex: curr.rowIndex,
          details: `Update profile (College: ${curr.college}, Program: ${curr.program})`,
          payload: {
            id: user.id,
            college: newCollege,
            program: newProgram
          }
        });
      }

      // Check account update
      const existingAcc = existingAccountMap.get(user.id);
      if (existingAcc) {
        if (
          existingAcc.row[ACCOUNT_COL.ROOM] !== curr.room ||
          existingAcc.row[ACCOUNT_COL.BED] !== curr.bed
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
            checkInDate: curr.checkInDate
          }
        });
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
      const row = new Array(11).fill("");
      row[ACCOUNT_COL.ID] = crypto.randomUUID();
      row[ACCOUNT_COL.RESIDENT_ID] = a.payload.residentId;
      row[ACCOUNT_COL.PERIOD] = a.payload.period;
      row[ACCOUNT_COL.ROOM] = a.payload.room;
      row[ACCOUNT_COL.BED] = a.payload.bed;
      row[ACCOUNT_COL.CHECK_IN_DATE] = a.payload.checkInDate;
      return row;
    });
    await appendSheetRow(uiSettings.accountingWorkbookId, "accounts!A:K", rows);
  }

  // 5. Mark CURR as Evaluated
  const currIndices = [...new Set(actions.map((a) => a.currIndex).filter(Boolean))];
  if (currIndices.length > 0 && uiSettings.residentRecordsId) {
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
  if (!uiSettings.accountingWorkbookId) throw new Error("Accounting Workbook ID not configured");

  const accRows = await fetchSheetRowsRaw(uiSettings.accountingWorkbookId, "accounts!A:I");
  const rowIndex = accRows.findIndex(
    (r) => r[ACCOUNT_COL.RESIDENT_ID] === residentId && r[ACCOUNT_COL.PERIOD] === term
  );

  if (rowIndex !== -1) {
    const actualRow = rowIndex + 1;
    await updateSheetValue(
      uiSettings.accountingWorkbookId,
      `accounts!D${actualRow}:E${actualRow}`,
      [[room, bed]]
    );
  } else {
    const newRow = new Array(11).fill("");
    newRow[ACCOUNT_COL.ID] = crypto.randomUUID();
    newRow[ACCOUNT_COL.RESIDENT_ID] = residentId;
    newRow[ACCOUNT_COL.PERIOD] = term;
    newRow[ACCOUNT_COL.ROOM] = room;
    newRow[ACCOUNT_COL.BED] = bed;
    await appendSheetRow(uiSettings.accountingWorkbookId, "accounts!A:K", [newRow]);
  }
}
