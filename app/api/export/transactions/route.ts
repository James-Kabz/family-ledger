import { getRepository } from "@/lib/repo";
import { isAuthenticated } from "@/lib/auth/session";
import { getTransferLabelFromTitle, isTransferRecordTitle } from "@/lib/expense-records";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";

type TransactionRow = {
  eventAtMs: number;
  recordedAtKenya: string;
  type: "Contribution" | "Expense" | "Transfer Out";
  nameOrTitle: string;
  amount: number;
  reference: string;
  pledged: string;
  note: string;
};

type ContributionRow = {
  reference: string;
  amount: number;
  name: string;
  recordedAtKenya: string;
  pledged: string;
  note: string;
};

type ExpenseRow = {
  recordedAtKenya: string;
  type: "Expense" | "Transfer Out";
  title: string;
  amount: number;
  note: string;
};

type SheetCell =
  | { type: "string"; value: string; style?: number }
  | { type: "number"; value: number; style?: number }
  | { type: "formula"; value: string; style?: number }
  | { type: "blank"; style?: number };

type WorkbookSheet = {
  name: string;
  rows: SheetCell[][];
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeSheetName(value: string) {
  const cleaned = value.replace(/[\\/:*?\[\]]/g, " ").trim() || "Sheet";
  return cleaned.slice(0, 31);
}

function toColumnName(column: number) {
  let current = column;
  let output = "";
  while (current > 0) {
    const rem = (current - 1) % 26;
    output = String.fromCharCode(65 + rem) + output;
    current = Math.floor((current - 1) / 26);
  }
  return output;
}

function cellRef(row: number, column: number) {
  return `${toColumnName(column)}${row}`;
}

function cellXml(cell: SheetCell, row: number, column: number) {
  const styleAttr = cell.style !== undefined ? ` s="${cell.style}"` : "";
  const ref = cellRef(row, column);

  if (cell.type === "blank") {
    return `<c r="${ref}"${styleAttr}/>`;
  }

  if (cell.type === "number") {
    const numeric = Number.isFinite(cell.value) ? cell.value : 0;
    return `<c r="${ref}"${styleAttr}><v>${numeric}</v></c>`;
  }

  if (cell.type === "formula") {
    return `<c r="${ref}"${styleAttr}><f>${escapeXml(cell.value)}</f></c>`;
  }

  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
}

function sheetXml(rows: SheetCell[][]) {
  const rowCount = rows.length;
  const maxColumns = Math.max(1, ...rows.map((row) => row.length));
  const dimensionRef = rowCount > 0 ? `A1:${toColumnName(maxColumns)}${rowCount}` : "A1:A1";

  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => cellXml(cell, rowIndex + 1, columnIndex + 1))
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimensionRef}"/>
  <sheetData>${body}</sheetData>
</worksheet>`;
}

function workbookXml(sheetNames: string[]) {
  const sheets = sheetNames
    .map(
      (sheetName, index) =>
        `<sheet name="${escapeXml(sheetName)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets}</sheets>
</workbook>`;
}

function workbookRelsXml(sheetCount: number) {
  const sheetRels = Array.from({ length: sheetCount }, (_, index) => {
    const id = index + 1;
    return `<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function contentTypesXml(sheetCount: number) {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, index) => {
    const id = index + 1;
    return `<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font>
      <sz val="11"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

function toDosDateTime(date: Date) {
  const year = date.getFullYear();
  if (year < 1980) {
    return { dosDate: 0, dosTime: 0 };
  }

  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  return { dosDate, dosTime };
}

let crcTable: Uint32Array | null = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[i] = c >>> 0;
  }
  return crcTable;
}

function crc32(input: Buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of input) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: Array<{ name: string; data: Buffer }>) {
  const now = toDosDateTime(new Date());
  const fileParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const checksum = crc32(data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(now.dosTime, 10);
    local.writeUInt16LE(now.dosDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);

    fileParts.push(local, data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(now.dosTime, 12);
    central.writeUInt16LE(now.dosDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);

    offset += local.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, centralDirectory, end]);
}

function buildWorkbookBuffer(sheets: WorkbookSheet[]) {
  const safeNames = sheets.map((sheet) => sanitizeSheetName(sheet.name));
  const entries: Array<{ name: string; data: Buffer }> = [
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml(sheets.length), "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRelsXml(), "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbookXml(safeNames), "utf8") },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRelsXml(sheets.length), "utf8") },
    { name: "xl/styles.xml", data: Buffer.from(stylesXml(), "utf8") },
  ];

  for (let i = 0; i < sheets.length; i += 1) {
    entries.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: Buffer.from(sheetXml(sheets[i].rows), "utf8"),
    });
  }

  return zip(entries);
}

function sCell(value: string, style?: number): SheetCell {
  return style === undefined ? { type: "string", value } : { type: "string", value, style };
}

function nCell(value: number, style?: number): SheetCell {
  return style === undefined ? { type: "number", value } : { type: "number", value, style };
}

function fCell(value: string, style?: number): SheetCell {
  return style === undefined ? { type: "formula", value } : { type: "formula", value, style };
}

function bCell(style?: number): SheetCell {
  return style === undefined ? { type: "blank" } : { type: "blank", style };
}

function headerRow(values: string[]) {
  return values.map((value) => sCell(value, 1));
}

function buildReconciliationRows() {
  const rows: SheetCell[][] = [
    headerRow(["Reconciliation template"]),
    [sCell("Paste statement transactions below. Columns E-G auto-check if each reference exists in this ledger export.")],
    [],
    headerRow([
      "Statement Ref",
      "Statement Amount (KES)",
      "Statement Date (Kenya)",
      "Sender / Source",
      "In Ledger?",
      "Ledger Amount (KES)",
      "Match Status",
      "Notes",
    ]),
  ];

  const TEMPLATE_ROWS = 400;
  for (let i = 0; i < TEMPLATE_ROWS; i += 1) {
    const rowNumber = i + 5;
    rows.push([
      bCell(),
      bCell(),
      bCell(),
      bCell(),
      fCell(`IF(A${rowNumber}="", "", IF(COUNTIF(Contributions!$A:$A, A${rowNumber})>0, "Yes", "No"))`),
      fCell(`IF(A${rowNumber}="", "", IFERROR(VLOOKUP(A${rowNumber}, Contributions!$A:$B, 2, FALSE), ""))`),
      fCell(`IF(A${rowNumber}="", "", IF(E${rowNumber}="No", "Not recorded", IF(F${rowNumber}=B${rowNumber}, "Matched", "Amount mismatch")))`),
      bCell(),
    ]);
  }

  return rows;
}

export async function GET() {
  const authed = await isAuthenticated();
  if (!authed) {
    return new Response("Unauthorized", { status: 401 });
  }

  const repo = getRepository();
  const [contributions, expenses] = await Promise.all([repo.listContributions(), repo.listExpenses()]);

  const contributionRows: ContributionRow[] = contributions.map((item) => ({
    reference: item.ref ?? "",
    amount: item.amount,
    name: item.name,
    recordedAtKenya: formatDateTime(item.contributedAt),
    pledged: item.pledged ? "Yes" : "No",
    note: item.note ?? "",
  }));

  const expenseRows: ExpenseRow[] = expenses.map((item) => ({
    recordedAtKenya: formatDateTime(item.spentAt),
    type: isTransferRecordTitle(item.title) ? "Transfer Out" : "Expense",
    title: isTransferRecordTitle(item.title) ? getTransferLabelFromTitle(item.title) : item.title,
    amount: item.amount,
    note: item.note ?? "",
  }));

  const transactionRows: TransactionRow[] = [
    ...contributions.map((item) => ({
      eventAtMs: new Date(item.contributedAt).getTime(),
      recordedAtKenya: formatDateTime(item.contributedAt),
      type: "Contribution" as const,
      nameOrTitle: item.name,
      amount: item.amount,
      reference: item.ref ?? "",
      pledged: item.pledged ? "Yes" : "No",
      note: item.note ?? "",
    })),
    ...expenses.map((item) => {
      const expenseType: "Transfer Out" | "Expense" = isTransferRecordTitle(item.title) ? "Transfer Out" : "Expense";
      return {
        eventAtMs: new Date(item.spentAt).getTime(),
        recordedAtKenya: formatDateTime(item.spentAt),
        type: expenseType,
        nameOrTitle: isTransferRecordTitle(item.title) ? getTransferLabelFromTitle(item.title) : item.title,
        amount: item.amount,
        reference: "",
        pledged: "",
        note: item.note ?? "",
      };
    }),
  ].sort((a, b) => b.eventAtMs - a.eventAtMs);

  const totalContributions = contributions.reduce((sum, item) => sum + item.amount, 0);
  const totalPledged = contributions.filter((item) => item.pledged).reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses
    .filter((item) => !isTransferRecordTitle(item.title))
    .reduce((sum, item) => sum + item.amount, 0);
  const totalTransfersOut = expenses
    .filter((item) => isTransferRecordTitle(item.title))
    .reduce((sum, item) => sum + item.amount, 0);

  const sheets: WorkbookSheet[] = [
    {
      name: "Transactions",
      rows: [
        headerRow(["Date (Kenya)", "Type", "Name / Title", "Amount (KES)", "Reference", "Pledged", "Note"]),
        ...transactionRows.map((row) => [
          sCell(row.recordedAtKenya),
          sCell(row.type),
          sCell(row.nameOrTitle),
          nCell(row.amount),
          sCell(row.reference),
          sCell(row.pledged),
          sCell(row.note),
        ]),
      ],
    },
    {
      name: "Contributions",
      rows: [
        headerRow(["Reference", "Amount (KES)", "Name", "Date (Kenya)", "Pledged", "Note"]),
        ...contributionRows.map((row) => [
          sCell(row.reference),
          nCell(row.amount),
          sCell(row.name),
          sCell(row.recordedAtKenya),
          sCell(row.pledged),
          sCell(row.note),
        ]),
      ],
    },
    {
      name: "Expenses",
      rows: [
        headerRow(["Date (Kenya)", "Type", "Title", "Amount (KES)", "Note"]),
        ...expenseRows.map((row) => [
          sCell(row.recordedAtKenya),
          sCell(row.type),
          sCell(row.title),
          nCell(row.amount),
          sCell(row.note),
        ]),
      ],
    },
    {
      name: "Summary",
      rows: [
        headerRow(["Metric", "Value"]),
        [sCell("Total Contributions"), nCell(totalContributions)],
        [sCell("Total Pledged (included in contributions)"), nCell(totalPledged)],
        [sCell("Total Expenses"), nCell(totalExpenses)],
        [sCell("Total Transfers Out"), nCell(totalTransfersOut)],
        [sCell("Net Balance (Contributions - Expenses - Transfers)"), nCell(totalContributions - totalExpenses - totalTransfersOut)],
        [sCell("Exported At (Kenya)"), sCell(formatDateTime(new Date()))],
      ],
    },
    {
      name: "Reconciliation",
      rows: buildReconciliationRows(),
    },
  ];

  const buffer = buildWorkbookBuffer(sheets);
  const fileDate = new Date().toISOString().slice(0, 10);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="family-ledger-transactions-${fileDate}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
