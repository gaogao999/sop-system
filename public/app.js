'use strict';

const $ = (sel) => document.querySelector(sel);

// --- i18n (English / Thai) -------------------------------------------------
const I18N = {
  en: {
    settings: '⚙ Settings', signout: 'Sign out',
    barcode: '📷 Barcode', bulk: '⧉ Bulk import (past files)', upload: '+ Upload',
    searchPh: '🔍 Search by product no, document no, title, product name or document content',
    sideType: 'Type', sideDept: 'Department', sideCust: 'Customer', sideProd: 'Product No.',
    newType: 'New type', newDept: 'New department', newCust: 'New customer', add: 'Add', prodPh: 'e.g. DD360',
    reviewDue: 'Review due (>2y)', showOld: 'Show old revisions',
    colDoc: 'Doc No. / Rev', colTitle: 'Title', colType: 'Type', colDept: 'Department',
    colCust: 'Customer', colSize: 'Size', colUploaded: 'Uploaded', colBy: 'By',
    files: (n) => `${n} file${n === 1 ? '' : 's'}`,
    due: (n) => ` · ${n} due for review`,
    productName: 'Product name', productNo: 'Product No.',
    current: (n) => `Current (${n} revisions)`, superseded: 'Superseded', badgeDue: '⚠ Review due (>2y)',
    download: 'Download', del: 'Delete', noFiles: 'No matching files',
    filteredBy: 'Filtered by product no', clear: '× Clear', all: 'All', none: 'None', selectDots: 'Select…',
    scanTitle: '🔎 Find inspection spec (barcode / product no)',
    scanHint: 'Point the camera at a QR / Data Matrix / barcode, or use a barcode reader / type a product number and press Enter.',
    scanPh: 'Scan / type a product number…', close: 'Close',
    searching: (c) => `Searching "${c}"…`, notFound: (c) => `❌ Not found: ${c}`,
    opened: (d) => `✓ Opened ${d}`, matches: (n) => `${n} matches — choose a document to open:`,
    pointCamera: 'Point the camera at a code…', cameraNoLoad: 'Camera scanner could not load.',
    cameraErr: (e) => `Camera error: ${e}. HTTPS and camera permission are required.`,
    bulkTitle: 'Bulk upload',
    bulkHint: "Drop PDFs here, or browse. Type, Department and Customer are auto-detected from each document number / header. Files where Type or Department can't be detected are skipped — use the single Upload form for those.",
    dropHere: 'Drop files here, or ', browse: 'browse',
    bulkReading: (f) => `${f} … reading`, bulkRead: (f, e) => `${f} — could not read (${e})`,
    bulkSkip: (f) => `${f} — skipped: Type/Department not detected (use single Upload)`,
    bulkOk: (f, d) => `${f} ✓ ${d}`,
    qrTitle: 'QR label', print: 'Print', qrHint: 'Scanning this code with the Barcode camera opens this document.',
    setTitle: '⚙ Settings', setHint: 'Add, rename or delete the Types, Departments and Customers used across the system.',
    rename: 'Rename', deleteW: 'Delete', noneYet: 'None yet',
    logTitle: 'Recent access log', logHint: '(views & downloads)',
    logWhen: 'When', logUser: 'User', logAction: 'Action', logDoc: 'Document', logNone: 'No access yet',
    upTitle: 'Upload SOP file', upFile: 'File (PDF / Excel / Word)',
    upDocNo: 'Document No.', upDocNoHint: '(auto-fills Type & Department, e.g. SOP-QC-0021)',
    upType: 'Type', upDept: 'Department', upCust: 'Customer', upOptional: '(optional)',
    upTitleF: 'Title', upTitlePh: 'Defaults to the file name if left blank',
    upRev: 'Revision (Rev)', upDate: 'Document date', upProdName: '品名 / Product name', upSop: '(SOP, optional)',
    upModel: 'Model', upProdNo: 'Product No.', upProdNoHint: '(barcode lookup key)',
    upDesc: 'Description (optional)', cancel: 'Cancel',
    reading: 'Reading header…', autofilled: '✓ Auto-filled from the document — please review before saving.',
    noHeader: 'No header fields detected — please fill them in.', autoskip: (e) => `Auto-fill skipped (${e}) — please fill them in.`,
    openNew: '↗ Open in new tab', vLoading: 'Loading… if it stays blank, use “Open in new tab”.',
    vOffice: 'This file type cannot be previewed in the browser. Use Download to open it.',
    vMissing: 'The file is missing on the server. On the free hosting plan, uploaded files are erased whenever the app restarts — re-upload it, or switch to persistent storage (local Docker / paid plan).',
    vHttp: (s) => `Could not load the document (HTTP ${s}).`, vErr: (e) => `Could not load the document (${e}).`,
    promptName: 'New name:', confirmDelFile: 'Delete this file?', confirmDelAxis: (l) => `Delete this ${l}?`,
    confirmDup: 'A document with this Doc No. and Rev already exists. Upload anyway?',
    dashboard: '📊 Dashboard', dashTitle: '📊 Dashboard', dashDocs: 'Documents',
    dashNoProd: 'No product no', dashNoCust: 'No customer', dashRecent: 'Recent uploads',
    csv: '⇅ CSV', csvTitle: 'CSV export / import',
    csvHint: 'Export the current list to a spreadsheet, edit the metadata, then import it back. Rows are matched by the id column; the document files themselves are not changed.',
    csvExport: '⬇ Export current list', csvImport: '⬆ Import edited CSV',
    csvEmpty: 'Nothing to export.', csvImporting: 'Importing…',
    csvDone: (u, total) => `✓ Updated ${u} of ${total} row(s).`,
    csvFail: (e) => `Import failed: ${e}`,
    printDate: 'Printed', printedBy: 'By',
    admin: '⚙ Manage', adminTitle: '⚙ Manage',
    homeAll: '🗂 All documents', homeFav: '★ Favorites', homeRecent: '🕘 Recently viewed', homePopular: '🔥 Most viewed (team)',
    emptyFav: 'No favorites yet — open a document and tap ☆ to add it here.',
    emptyRecent: 'Documents you open will appear here.',
    emptyPopular: 'The most-opened documents will appear here.',
    emptyAll: 'No documents yet — add one from Manage ▸ New document (DAR).',
    moreDocs: (n) => `+${n} more — use search to narrow down.`,
    inText: 'in text', relevance: 'Best match',
    // ISO document control
    dar: '📝 New document (DAR)', darTitle: '📝 New document (DAR)',
    darHint: 'Submit a Document Action Request. The number is generated automatically; the document starts in Pending Review.',
    darAutoHint: 'Attach the document first — the category, department and title are read from it automatically. Review, then submit. The number is generated for you.',
    darCategory: 'Category', darNumber: 'Document No.', darDetail: 'Detail of revision', darSubmit: 'Submit DAR',
    darRead: '📄 Read file', darReadHint: 'Reads category / department / title from the document', darNoFile: 'Choose a file first.',
    darRequestFor: 'Request for', darPages: 'Page(s)',
    darFrom: 'From', darDate: 'Date', darOldRev: 'Old Revise', darNewRev: 'New Revise',
    darEffNote: 'Effective Date', darOnApproval: 'recorded automatically on approval', darComment: 'Comment',
    darImportForm: '⬆ Import filled FDC-001 (Excel)', darImportHint: 'Reads all fields from a completed FDC-001 form', darImported: '✓ Read from FDC-001 — please review.',
    apprPrepared: 'Prepared by', apprChecked: 'Checked by', apprApproved: 'Approved by', apprPending: 'pending',
    batchDar: '📚 Batch DAR (multiple)', batchTitle: '📚 Batch DAR (multiple documents)',
    batchHint: "Drop several documents. Each is auto-classified from its document number and submitted on one DAR, then approved together. Files whose Type/Department can't be detected are skipped — use the single DAR for those.",
    batchApproveAll: '✓ Approve all', batchSubmitting: 'Submitting…',
    batchDone: (n, sk) => `✓ ${n} document(s) submitted on one DAR.${sk ? ` ${sk} skipped.` : ''}`,
    batchApproved: (n) => `✓ Approved ${n} document(s).`, batchSkip: (f, r) => `${f} — skipped: ${r}`,
    docGroup: (n) => `DAR · ${n} documents`,
    reqNew: 'Issue New Document', reqChange: 'Change / Modification', reqCopy: 'Request Additional copy', reqCancel: 'Cancel document',
    mlDocNo: 'Document No.', mlDocName: 'Document Name', mlModel: 'Model', mlRevDate: 'Rev. Date',
    approvals: '✅ Approvals', approvalsTitle: '✅ Approvals',
    approvalsHint: 'Documents awaiting review or approval. Approving advances the stage; the final approval makes it the effective MASTER DOCUMENT.',
    masterList: '📋 Master List', masterTitle: '📋 Master List',
    mlStatusCol: 'Status', mlEffective: 'Effective', mlReview: 'Next review',
    distributions: '📦 Distributions', distTitle: '📦 Distributions',
    distHint: 'Controlled-print distributions. The receiving department confirms receipt here.',
    stDraft: 'Draft', stPendingReview: 'Pending Review', stPendingApproval: 'Pending Approval',
    stMaster: 'MASTER DOCUMENT', stVoid: 'VOID', stCancelled: 'Cancelled',
    approve: 'Approve', reject: 'Reject', submitDoc: 'Submit for review',
    distribute: 'Distribute', revise: 'Revise', annualReview: 'Record review', receive: 'Confirm receipt',
    received: 'Received', notReceived: 'Awaiting receipt', rejectPrompt: 'Reason for rejection (optional):',
    reviseFile: 'Choose revised file…', revHistory: 'Revision history', effLabel: 'Effective', revwLabel: 'Next review',
    distTo: 'Distribute to…', noApprovals: 'Nothing awaiting approval.', noDist: 'No distributions yet.',
    queueAll: 'All', emptyMaster: 'No documents yet.', darDistedTo: 'Distributed to',
  },
  th: {
    settings: '⚙ ตั้งค่า', signout: 'ออกจากระบบ',
    barcode: '📷 บาร์โค้ด', bulk: '⧉ นำเข้าไฟล์เดิม (จำนวนมาก)', upload: '+ อัปโหลด',
    searchPh: '🔍 ค้นหาด้วยรหัสสินค้า เลขเอกสาร ชื่อ ชื่อสินค้า หรือเนื้อหา',
    sideType: 'ประเภท', sideDept: 'แผนก', sideCust: 'ลูกค้า', sideProd: 'รหัสสินค้า',
    newType: 'เพิ่มประเภท', newDept: 'เพิ่มแผนก', newCust: 'เพิ่มลูกค้า', add: 'เพิ่ม', prodPh: 'เช่น DD360',
    reviewDue: 'ครบกำหนดทบทวน (>2 ปี)', showOld: 'แสดงฉบับเก่า',
    colDoc: 'เลขเอกสาร / ฉบับ', colTitle: 'ชื่อเอกสาร', colType: 'ประเภท', colDept: 'แผนก',
    colCust: 'ลูกค้า', colSize: 'ขนาด', colUploaded: 'อัปโหลดเมื่อ', colBy: 'โดย',
    files: (n) => `${n} เอกสาร`,
    due: (n) => ` · ${n} รายการครบกำหนดทบทวน`,
    productName: 'ชื่อสินค้า', productNo: 'รหัสสินค้า',
    current: (n) => `ปัจจุบัน (${n} ฉบับ)`, superseded: 'ฉบับเก่า', badgeDue: '⚠ ครบกำหนดทบทวน (>2 ปี)',
    download: 'ดาวน์โหลด', del: 'ลบ', noFiles: 'ไม่พบเอกสาร',
    filteredBy: 'กรองตามรหัสสินค้า', clear: '× ล้าง', all: 'ทั้งหมด', none: 'ไม่ระบุ', selectDots: 'เลือก…',
    scanTitle: '🔎 ค้นหาเอกสารตรวจสอบ (บาร์โค้ด / รหัสสินค้า)',
    scanHint: 'ส่องกล้องไปที่ QR / Data Matrix / บาร์โค้ด หรือใช้เครื่องอ่านบาร์โค้ด / พิมพ์รหัสสินค้าแล้วกด Enter',
    scanPh: 'สแกน / พิมพ์รหัสสินค้า…', close: 'ปิด',
    searching: (c) => `กำลังค้นหา "${c}"…`, notFound: (c) => `❌ ไม่พบ: ${c}`,
    opened: (d) => `✓ เปิด ${d}`, matches: (n) => `พบ ${n} รายการ — เลือกเอกสารที่จะเปิด:`,
    pointCamera: 'ส่องกล้องไปที่โค้ด…', cameraNoLoad: 'โหลดตัวสแกนกล้องไม่สำเร็จ',
    cameraErr: (e) => `กล้องผิดพลาด: ${e} ต้องใช้ HTTPS และอนุญาตกล้อง`,
    bulkTitle: 'อัปโหลดหลายไฟล์',
    bulkHint: 'วางไฟล์ PDF ที่นี่ หรือเลือกไฟล์ ระบบจะตรวจหาประเภท แผนก และลูกค้าจากเลขเอกสาร/หัวเอกสารโดยอัตโนมัติ ไฟล์ที่ตรวจประเภท/แผนกไม่ได้จะถูกข้าม — ใช้ฟอร์มอัปโหลดทีละไฟล์แทน',
    dropHere: 'วางไฟล์ที่นี่ หรือ ', browse: 'เลือกไฟล์',
    bulkReading: (f) => `${f} … กำลังอ่าน`, bulkRead: (f, e) => `${f} — อ่านไม่สำเร็จ (${e})`,
    bulkSkip: (f) => `${f} — ข้าม: ตรวจประเภท/แผนกไม่ได้ (ใช้อัปโหลดทีละไฟล์)`,
    bulkOk: (f, d) => `${f} ✓ ${d}`,
    qrTitle: 'ป้าย QR', print: 'พิมพ์', qrHint: 'สแกนโค้ดนี้ด้วยกล้องบาร์โค้ดเพื่อเปิดเอกสารนี้',
    setTitle: '⚙ ตั้งค่า', setHint: 'เพิ่ม แก้ชื่อ หรือลบ ประเภท แผนก และลูกค้า ที่ใช้ในระบบ',
    rename: 'แก้ชื่อ', deleteW: 'ลบ', noneYet: 'ยังไม่มี',
    logTitle: 'ประวัติการเข้าถึงล่าสุด', logHint: '(เปิดดู & ดาวน์โหลด)',
    logWhen: 'เมื่อ', logUser: 'ผู้ใช้', logAction: 'การกระทำ', logDoc: 'เอกสาร', logNone: 'ยังไม่มีการเข้าถึง',
    upTitle: 'อัปโหลดเอกสาร SOP', upFile: 'ไฟล์ (PDF / Excel / Word)',
    upDocNo: 'เลขเอกสาร', upDocNoHint: '(เติมประเภท & แผนกอัตโนมัติ เช่น SOP-QC-0021)',
    upType: 'ประเภท', upDept: 'แผนก', upCust: 'ลูกค้า', upOptional: '(ไม่บังคับ)',
    upTitleF: 'ชื่อเอกสาร', upTitlePh: 'หากเว้นว่างจะใช้ชื่อไฟล์',
    upRev: 'ฉบับแก้ไข (Rev)', upDate: 'วันที่เอกสาร', upProdName: 'ชื่อสินค้า', upSop: '(SOP, ไม่บังคับ)',
    upModel: 'รุ่น (Model)', upProdNo: 'รหัสสินค้า', upProdNoHint: '(ใช้ค้นด้วยบาร์โค้ด)',
    upDesc: 'รายละเอียด (ไม่บังคับ)', cancel: 'ยกเลิก',
    reading: 'กำลังอ่านหัวเอกสาร…', autofilled: '✓ เติมจากเอกสารแล้ว — โปรดตรวจก่อนบันทึก',
    noHeader: 'ไม่พบข้อมูลหัวเอกสาร — โปรดกรอกเอง', autoskip: (e) => `ข้ามการเติมอัตโนมัติ (${e}) — โปรดกรอกเอง`,
    openNew: '↗ เปิดในแท็บใหม่', vLoading: 'กำลังโหลด… หากยังว่าง ให้ใช้ “เปิดในแท็บใหม่”',
    vOffice: 'ไฟล์ประเภทนี้แสดงตัวอย่างในเบราว์เซอร์ไม่ได้ กรุณาดาวน์โหลด',
    vMissing: 'ไม่พบไฟล์บนเซิร์ฟเวอร์ ในแพ็กเกจฟรี ไฟล์ที่อัปโหลดจะถูกลบเมื่อแอปรีสตาร์ท — อัปโหลดใหม่ หรือเปลี่ยนไปใช้ที่เก็บถาวร',
    vHttp: (s) => `โหลดเอกสารไม่สำเร็จ (HTTP ${s})`, vErr: (e) => `โหลดเอกสารไม่สำเร็จ (${e})`,
    promptName: 'ชื่อใหม่:', confirmDelFile: 'ลบเอกสารนี้?', confirmDelAxis: (l) => `ลบ ${l} นี้?`,
    confirmDup: 'มีเอกสารเลขที่และฉบับนี้อยู่แล้ว ต้องการอัปโหลดต่อหรือไม่?',
    dashboard: '📊 แดชบอร์ด', dashTitle: '📊 แดชบอร์ด', dashDocs: 'เอกสาร',
    dashNoProd: 'ไม่มีรหัสสินค้า', dashNoCust: 'ไม่มีลูกค้า', dashRecent: 'อัปโหลดล่าสุด',
    csv: '⇅ CSV', csvTitle: 'นำออก / นำเข้า CSV',
    csvHint: 'นำรายการปัจจุบันออกเป็นสเปรดชีต แก้ไขข้อมูล แล้วนำเข้ากลับ ระบบจับคู่แถวด้วยคอลัมน์ id โดยไม่แก้ไขไฟล์เอกสาร',
    csvExport: '⬇ นำออกรายการปัจจุบัน', csvImport: '⬆ นำเข้า CSV ที่แก้ไข',
    csvEmpty: 'ไม่มีข้อมูลให้นำออก', csvImporting: 'กำลังนำเข้า…',
    csvDone: (u, total) => `✓ อัปเดต ${u} จาก ${total} แถว`,
    csvFail: (e) => `นำเข้าไม่สำเร็จ: ${e}`,
    printDate: 'พิมพ์เมื่อ', printedBy: 'โดย',
    admin: '⚙ จัดการ', adminTitle: '⚙ จัดการ',
    homeAll: '🗂 เอกสารทั้งหมด', homeFav: '★ รายการโปรด', homeRecent: '🕘 เปิดล่าสุด', homePopular: '🔥 เปิดบ่อย (ทีม)',
    emptyFav: 'ยังไม่มีรายการโปรด — เปิดเอกสารแล้วแตะ ☆ เพื่อเพิ่ม',
    emptyRecent: 'เอกสารที่คุณเปิดจะแสดงที่นี่',
    emptyPopular: 'เอกสารที่เปิดบ่อยจะแสดงที่นี่',
    emptyAll: 'ยังไม่มีเอกสาร — เพิ่มได้จาก จัดการ ▸ เอกสารใหม่ (DAR)',
    moreDocs: (n) => `+อีก ${n} รายการ — ใช้ค้นหาเพื่อจำกัดผล`,
    inText: 'ในเนื้อหา', relevance: 'ตรงที่สุด',
    // ISO document control
    dar: '📝 เอกสารใหม่ (DAR)', darTitle: '📝 เอกสารใหม่ (DAR)',
    darHint: 'ส่งคำขอจัดทำเอกสาร (DAR) ระบบจะออกเลขให้อัตโนมัติ และเริ่มที่สถานะรอตรวจสอบ',
    darAutoHint: 'แนบไฟล์ก่อน — ระบบจะอ่านประเภท แผนก และชื่อเอกสารให้อัตโนมัติ ตรวจสอบแล้วจึงส่ง เลขเอกสารจะออกให้อัตโนมัติ',
    darCategory: 'ประเภทเอกสาร', darNumber: 'เลขเอกสาร', darDetail: 'รายละเอียดการแก้ไข', darSubmit: 'ส่ง DAR',
    darRead: '📄 อ่านไฟล์', darReadHint: 'อ่านประเภท / แผนก / ชื่อ จากเอกสาร', darNoFile: 'เลือกไฟล์ก่อน',
    darRequestFor: 'คำขอ', darPages: 'หน้า',
    darFrom: 'จาก', darDate: 'วันที่', darOldRev: 'ฉบับเดิม', darNewRev: 'ฉบับใหม่',
    darEffNote: 'วันที่มีผล', darOnApproval: 'บันทึกอัตโนมัติเมื่ออนุมัติ', darComment: 'หมายเหตุ',
    darImportForm: '⬆ นำเข้า FDC-001 (Excel)', darImportHint: 'อ่านทุกช่องจากแบบฟอร์ม FDC-001 ที่กรอกแล้ว', darImported: '✓ อ่านจาก FDC-001 แล้ว — โปรดตรวจสอบ',
    apprPrepared: 'จัดทำโดย', apprChecked: 'ตรวจสอบโดย', apprApproved: 'อนุมัติโดย', apprPending: 'รอดำเนินการ',
    batchDar: '📚 DAR หลายฉบับ', batchTitle: '📚 DAR หลายเอกสาร',
    batchHint: 'วางหลายไฟล์ ระบบจะแยกประเภทจากเลขเอกสารและส่งเป็น DAR เดียว แล้วอนุมัติพร้อมกัน ไฟล์ที่ตรวจประเภท/แผนกไม่ได้จะถูกข้าม — ใช้ DAR ทีละฉบับแทน',
    batchApproveAll: '✓ อนุมัติทั้งหมด', batchSubmitting: 'กำลังส่ง…',
    batchDone: (n, sk) => `✓ ส่งแล้ว ${n} เอกสารใน DAR เดียว${sk ? ` ข้าม ${sk}` : ''}`,
    batchApproved: (n) => `✓ อนุมัติแล้ว ${n} เอกสาร`, batchSkip: (f, r) => `${f} — ข้าม: ${r}`,
    docGroup: (n) => `DAR · ${n} เอกสาร`,
    reqNew: 'ขอออกเอกสารใหม่', reqChange: 'ขอเปลี่ยนแปลงเอกสาร', reqCopy: 'ขอสำเนาเพิ่มเติม', reqCancel: 'ยกเลิกเอกสาร',
    mlDocNo: 'เลขเอกสาร', mlDocName: 'ชื่อเอกสาร', mlModel: 'รุ่น', mlRevDate: 'วันที่แก้ไข',
    approvals: '✅ การอนุมัติ', approvalsTitle: '✅ การอนุมัติ',
    approvalsHint: 'เอกสารที่รอตรวจสอบ/อนุมัติ การอนุมัติจะเลื่อนขั้น และการอนุมัติขั้นสุดท้ายจะทำให้เป็น MASTER DOCUMENT',
    masterList: '📋 Master List', masterTitle: '📋 Master List',
    mlStatusCol: 'สถานะ', mlEffective: 'วันที่มีผล', mlReview: 'ทบทวนครั้งถัดไป',
    distributions: '📦 การแจกจ่าย', distTitle: '📦 การแจกจ่าย',
    distHint: 'การแจกจ่ายสำเนาควบคุม แผนกผู้รับยืนยันการรับที่นี่',
    stDraft: 'ฉบับร่าง', stPendingReview: 'รอตรวจสอบ', stPendingApproval: 'รออนุมัติ',
    stMaster: 'MASTER DOCUMENT', stVoid: 'VOID', stCancelled: 'ยกเลิก',
    approve: 'อนุมัติ', reject: 'ตีกลับ', submitDoc: 'ส่งตรวจสอบ',
    distribute: 'แจกจ่าย', revise: 'แก้ไขฉบับ', annualReview: 'บันทึกการทบทวน', receive: 'ยืนยันการรับ',
    received: 'รับแล้ว', notReceived: 'รอการรับ', rejectPrompt: 'เหตุผลที่ตีกลับ (ไม่บังคับ):',
    reviseFile: 'เลือกไฟล์ฉบับแก้ไข…', revHistory: 'ประวัติการแก้ไข', effLabel: 'วันที่มีผล', revwLabel: 'ทบทวนครั้งถัดไป',
    distTo: 'แจกจ่ายไปยัง…', noApprovals: 'ไม่มีรายการรออนุมัติ', noDist: 'ยังไม่มีการแจกจ่าย',
    queueAll: 'ทั้งหมด', emptyMaster: 'ยังไม่มีเอกสาร', darDistedTo: 'แจกจ่ายไปยัง',
  },
};
let LANG = localStorage.getItem('lang') === 'th' ? 'th' : 'en';
function t(key, ...args) {
  const v = (I18N[LANG] && I18N[LANG][key]) ?? I18N.en[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}
function applyLang(lang) {
  if (lang) {
    LANG = lang;
    localStorage.setItem('lang', lang);
  }
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  const tog = $('#langToggle');
  if (tog) tog.textContent = LANG === 'en' ? 'ไทย' : 'EN';
  // Re-render the parts built in JS so their language updates too
  for (const k of Object.keys(AXES)) {
    renderAxis(k);
    renderAxisOptions(k);
  }
  renderActiveCode();
  if (lastFiles.length || $('#fileRows').children.length) renderFiles(lastFiles);
  if (!$('#home').hidden) renderHome();
  if ($('#settingsDialog').open) renderSettings();
}
// One descriptor per filter axis keeps the two lists (type / department) DRY.
const AXES = {
  type: {
    api: '/api/doc-types',
    listEl: '#typeList',
    uploadEl: '#uploadType',
    queryKey: 'type',
    label: 'type',
  },
  department: {
    api: '/api/departments',
    listEl: '#departmentList',
    uploadEl: '#uploadDepartment',
    queryKey: 'department',
    label: 'department',
  },
  customer: {
    api: '/api/customers',
    listEl: '#customerList',
    uploadEl: '#uploadCustomer',
    queryKey: 'customer',
    label: 'customer',
    optional: true, // optional on upload + offers a "None" filter
  },
};
const state = {
  type: { items: [], active: 'all' },
  department: { items: [], active: 'all' },
  customer: { items: [], active: 'all' },
  q: '',
  code: '', // exact product-code filter, '' = none
  productNo: '', // sidebar Product No. partial filter
  showOld: false, // include superseded revisions
  expiredOnly: false, // only documents due for review (>2 years old)
  sort: { key: 'uploaded_at', dir: 'desc' }, // column sort
};
let lastFiles = []; // most recent server result, re-sorted on header click
let currentDoc = null; // document open in the viewer (for the print stamp)
let currentUser = ''; // display name of the signed-in user (for the print stamp)

// --- Utilities -------------------------------------------------------------
const fmtSize = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
// Date only (time is kept in the data but not shown in the list)
const fmtDay = (iso) => {
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
};
// Date + time (used in the access log)
const fmtDateTime = (iso) => {
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, '0');
  return `${fmtDay(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
// Icon by document type, colour-coded: SOP=red, QP=blue, Format=green
const TYPE_ICON = { SOP: '📕', QP: '📘', Format: '📗' };
const iconFor = (f) => TYPE_ICON[f.doc_type_name] || '📄';
const esc = (s) =>
  (s ?? '').toString().replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
// Browsers can render PDFs inline; Office files (xls/doc) can't be previewed
const isPdf = (f) =>
  f.mimetype === 'application/pdf' || /\.pdf$/i.test(f.original_name || '');

// Escape text, then wrap occurrences of the search term in <mark> for highlight
function highlight(text, term) {
  const safe = esc(text);
  const q = (term || '').trim();
  if (!q) return safe;
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return safe.replace(re, '<mark>$1</mark>');
}

// Remember every document we've shown (results + home shelves) by id, so the
// viewer can find its metadata (print stamp, ★ state) wherever it was opened.
const docCache = {};
const rememberDocs = (arr) => (arr || []).forEach((f) => (docCache[f.id] = f));

// Parse the document's printed date (e.g. "18-Sep-25", "16-May-2025"); returns
// a Date or null. Used to flag documents due for review (older than 2 years).
const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
function parseDocDate(s) {
  const m = (s || '').match(/(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})/);
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon === undefined) return null;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  return new Date(year, mon, Number(m[1]));
}
const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000;
// A document is "due for review" if its own date (or upload date) is >2 years ago
function isExpired(f) {
  const base = parseDocDate(f.doc_date) || new Date(f.uploaded_at);
  return Date.now() - base.getTime() > TWO_YEARS_MS;
}

async function api(path, opts) {
  const res = await fetch(path, { headers: { Accept: 'application/json' }, ...opts });
  if (res.status === 401) {
    location.href = '/login.html';
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Error (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// --- Filter axes (type / department) ---------------------------------------
async function loadAxis(key) {
  const axis = AXES[key];
  state[key].items = await api(axis.api);
  renderAxis(key);
  renderAxisOptions(key);
}

// Single source of truth for an axis selection (sidebar)
function setActive(key, value) {
  state[key].active = value;
  renderAxis(key);
  loadFiles();
}

function renderAxis(key) {
  const axis = AXES[key];
  const s = state[key];
  const total = s.items.reduce((sum, c) => sum + c.file_count, 0);
  const items = [{ id: 'all', name: t('all'), file_count: total, fixed: true }, ...s.items];
  // Optional axes can have unassigned files — offer a "None" filter for them
  if (axis.optional) items.push({ id: 'none', name: t('none'), file_count: -1, fixed: true });
  $(axis.listEl).innerHTML = items
    .map((c) => {
      const active = String(s.active) === String(c.id) ? ' active' : '';
      const count = c.file_count >= 0 ? `<span class="count">${c.file_count}</span>` : '';
      const del = c.fixed
        ? ''
        : `<button class="del-item" data-id="${c.id}" title="Delete">×</button>`;
      return `<li class="filter-item${active}" data-id="${c.id}">
        <span class="filter-name">${esc(c.name)}</span>${count}${del}</li>`;
    })
    .join('');
}

function renderAxisOptions(key) {
  const axis = AXES[key];
  const opts = state[key].items
    .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
    .join('');
  // Optional selects allow an empty choice; required ones force an explicit pick
  $(axis.uploadEl).innerHTML = axis.optional
    ? `<option value="">— (${t('none')})</option>${opts}`
    : `<option value="" disabled selected>${t('selectDots')}</option>${opts}`;
}

// Clickable product-code chips — click one to filter the list by it
function codeChips(f) {
  // f.codes = space-separated product codes + the doc number; drop the doc no
  const codes = (f.codes || '').split(' ').filter((c) => c && c !== f.doc_no);
  if (codes.length === 0) {
    return f.product_no ? `<div class="file-desc">${t('productNo')}: ${esc(f.product_no)}</div>` : '';
  }
  const chips = codes
    .map(
      (c) =>
        `<button class="code-chip${state.code === c ? ' active' : ''}" data-code="${esc(c)}">${esc(c)}</button>`
    )
    .join('');
  return `<div class="code-chips">${t('productNo')}: ${chips}</div>`;
}

// Open a document in the in-app preview (no download needed)
let viewBlobUrl = null; // object URL of the document currently previewed
function resetViewer() {
  const frame = $('#viewFrame');
  frame.onload = null;
  frame.removeAttribute('src');
  if (viewBlobUrl) {
    URL.revokeObjectURL(viewBlobUrl);
    viewBlobUrl = null;
  }
}

async function openView(id, name, pdf) {
  currentDoc = docCache[id] || lastFiles.find((f) => String(f.id) === String(id)) || null;
  const inlineUrl = `/api/files/${id}/download?inline=1`;
  $('#viewTitle').textContent = name || 'Document';
  $('#viewDownload').href = `/api/files/${id}/download`;
  $('#viewNewTab').href = inlineUrl;
  updateViewFav();
  showIsoPanel(currentDoc);
  const frame = $('#viewFrame');
  const notice = $('#viewNotice');
  const loading = $('#viewLoading');
  resetViewer();
  $('#viewDialog').showModal();

  if (!pdf) {
    // Office files can't be rendered inline by the browser
    loading.hidden = true;
    frame.hidden = true;
    $('#viewNewTab').hidden = true;
    notice.hidden = false;
    notice.textContent = t('vOffice');
    return;
  }

  // Fetch first, so a missing file shows a clear message instead of a blank box,
  // and render from a blob URL (reliable in-browser PDF display).
  notice.hidden = true;
  frame.hidden = false;
  $('#viewNewTab').hidden = false;
  loading.hidden = false;
  loading.textContent = 'Loading…';
  try {
    const res = await fetch(inlineUrl, { headers: { Accept: 'application/pdf' } });
    if (res.status === 401) {
      location.href = '/login.html';
      return;
    }
    if (!res.ok) {
      frame.hidden = true;
      loading.hidden = true;
      notice.hidden = false;
      notice.textContent = res.status === 410 ? t('vMissing') : t('vHttp', res.status);
      return;
    }
    const blob = await res.blob();
    viewBlobUrl = URL.createObjectURL(blob);
    frame.onload = () => {
      loading.hidden = true;
    };
    frame.src = viewBlobUrl;
  } catch (err) {
    frame.hidden = true;
    loading.hidden = true;
    notice.hidden = false;
    notice.textContent = t('vErr', err.message);
  }
}

function closeView() {
  resetViewer();
  $('#viewDialog').close();
  // Refresh any view left open underneath (status may have changed)
  if ($('#masterDialog').open) renderMaster();
  if ($('#approvalsDialog').open) renderApprovals();
  if (!$('#home').hidden) renderHome();
}

// Print the open document with an auto-stamped header (document no., revision,
// document date, print date/time, printed-by) for ISO controlled-copy records.
// The stamp is print-only (revealed by the @media print rules); the document
// itself prints from the viewer iframe.
function printDoc() {
  const f = currentDoc || {};
  const now = new Date();
  $('#printStamp').innerHTML =
    `<div class="ps-bar">` +
    `<span class="ps-doc">${esc(f.doc_no || '')}</span>` +
    `<span class="ps-rev">Rev. ${esc(f.revision || '-')}</span>` +
    (f.doc_date ? `<span class="ps-date">${esc(f.doc_date)}</span>` : '') +
    `</div>` +
    `<div class="ps-title">${esc(f.title || $('#viewTitle').textContent || '')}</div>` +
    `<div class="ps-meta">${t('printDate')}: ${fmtDateTime(now.toISOString())}` +
    (currentUser ? ` · ${t('printedBy')}: ${esc(currentUser)}` : '') +
    `</div>`;
  window.print();
}

// --- Favorites (★) + home shelves -----------------------------------------
function updateViewFav() {
  const btn = $('#viewFav');
  const on = !!(currentDoc && currentDoc.favorited);
  btn.textContent = on ? '★' : '☆';
  btn.classList.toggle('on', on);
}

const favInFlight = new Set(); // guard against a double-trigger toggling back
async function toggleFavorite(id) {
  if (favInFlight.has(String(id))) return;
  favInFlight.add(String(id));
  let r;
  try {
    r = await api(`/api/files/${id}/favorite`, { method: 'POST' });
  } catch {
    return;
  } finally {
    favInFlight.delete(String(id));
  }
  const on = !!r.favorited;
  if (docCache[id]) docCache[id].favorited = on ? 1 : 0;
  const hit = lastFiles.find((f) => String(f.id) === String(id));
  if (hit) hit.favorited = on ? 1 : 0;
  // Update every star button for this document that's currently on screen
  document.querySelectorAll(`.fav-btn[data-id="${id}"]`).forEach((b) => {
    b.classList.toggle('on', on);
    b.textContent = on ? '★' : '☆';
  });
  if (currentDoc && String(currentDoc.id) === String(id)) updateViewFav();
  if (!$('#home').hidden) renderHome(); // keep the Favorites shelf in sync
}

// A compact document card for the home shelves
function cardHtml(f) {
  return `<button class="doc-card" data-id="${f.id}" data-name="${esc(f.title)}" data-pdf="${isPdf(f) ? 1 : 0}">
    <span class="fav-btn${f.favorited ? ' on' : ''}" data-id="${f.id}" role="button" title="★">${f.favorited ? '★' : '☆'}</span>
    <span class="card-icon">${iconFor(f)}</span>
    <span class="card-doc">${esc(f.doc_no || '·')}</span>
    <span class="card-title">${esc(f.title)}</span>
    <span class="card-meta">${esc(f.doc_type_name || '')}${f.department_name ? ' · ' + esc(f.department_name) : ''}</span>
    ${f.status && f.status !== 'master' ? `<span class="card-status">${statusBadge(f.status)}</span>` : ''}
  </button>`;
}
function renderShelf(sel, files, emptyKey) {
  rememberDocs(files);
  const el = $(sel);
  el.innerHTML =
    files && files.length ? files.map(cardHtml).join('') : `<p class="shelf-empty">${t(emptyKey)}</p>`;
}
const ALL_DOCS_CAP = 60; // cards shown in "All documents" before nudging to search
async function renderHome(seq = ++loadSeq) {
  let data, all;
  try {
    [data, all] = await Promise.all([api('/api/home'), api('/api/files')]);
  } catch {
    return;
  }
  if (seq !== loadSeq) return; // a newer load started while we were fetching
  // "All documents" — every current document, newest first, so anything just
  // registered is always visible here (with its status badge) without searching.
  rememberDocs(all);
  const shown = all.slice(0, ALL_DOCS_CAP);
  $('#homeAll').innerHTML = all.length
    ? shown.map(cardHtml).join('') +
      (all.length > ALL_DOCS_CAP ? `<p class="shelf-empty">${t('moreDocs', all.length - ALL_DOCS_CAP)}</p>` : '')
    : `<p class="shelf-empty">${t('emptyAll')}</p>`;
  renderShelf('#homeFav', data.favorites, 'emptyFav');
  renderShelf('#homeRecent', data.recent, 'emptyRecent');
  renderShelf('#homePopular', data.popular, 'emptyPopular');
  $('#results').hidden = true;
  $('#home').hidden = false;
}

// "Browsing" = nothing is being searched or filtered -> show the home shelves
function isBrowsing() {
  return (
    !state.q &&
    !state.code &&
    !state.productNo &&
    !state.showOld &&
    !state.expiredOnly &&
    Object.keys(AXES).every((k) => state[k].active === 'all')
  );
}

// Resolve a lookup item id by its name (case-insensitive); null if no match
function matchId(key, name) {
  if (!name) return null;
  const hit = state[key].items.find(
    (c) => c.name.toLowerCase() === String(name).trim().toLowerCase()
  );
  return hit ? hit.id : null;
}

// --- Bulk upload (auto-extract + auto-classify each file) -------------------
async function processBulk(fileList) {
  const list = $('#bulkResults');
  for (const file of [...fileList]) {
    const li = document.createElement('li');
    li.className = 'scan-hit';
    li.textContent = t('bulkReading', file.name);
    list.appendChild(li);
    await bulkOne(file, li);
  }
  await loadFiles();
  await Promise.all([loadAxis('type'), loadAxis('department'), loadAxis('customer')]);
}

async function bulkOne(file, li) {
  let meta;
  try {
    const fd = new FormData();
    fd.append('file', file);
    meta = await api('/api/extract', { method: 'POST', body: fd });
  } catch (e) {
    li.className = 'scan-hit bulk-warn';
    li.textContent = t('bulkRead', file.name, e.message);
    return;
  }
  const typeId = matchId('type', meta.type_code);
  const deptId = matchId('department', meta.dept_code);
  if (!typeId || !deptId) {
    li.className = 'scan-hit bulk-warn';
    li.textContent = t('bulkSkip', file.name);
    return;
  }
  const up = new FormData();
  up.append('file', file);
  up.append('force', '1'); // bulk is intentional; don't block on duplicates
  up.append('title', meta.title || '');
  up.append('doc_type_id', typeId);
  up.append('department_id', deptId);
  const custId = matchId('customer', meta.customer_name);
  if (custId) up.append('customer_id', custId);
  for (const k of ['doc_no', 'revision', 'doc_date', 'product_name', 'model', 'product_no']) {
    up.append(k, meta[k] || '');
  }
  try {
    await api('/api/files', { method: 'POST', body: up });
    li.className = 'scan-hit bulk-ok';
    li.textContent = t('bulkOk', file.name, meta.doc_no || meta.title || '');
  } catch (e) {
    li.className = 'scan-hit bulk-warn';
    li.textContent = `${file.name} — ${e.message}`;
  }
}

// --- QR label --------------------------------------------------------------
let qrCurrent = { code: '', label: '' };
function openQr(code, label) {
  qrCurrent = { code: code || '', label: label || code || '' };
  const cont = $('#qrCode');
  cont.innerHTML = '';
  try {
    const svg = new ZXing.BrowserQRCodeSvgWriter().write(qrCurrent.code, 240, 240);
    cont.appendChild(svg);
  } catch (e) {
    cont.textContent = `QR error: ${e.message}`;
  }
  $('#qrText').textContent = qrCurrent.label;
  $('#qrDialog').showModal();
}
function printQr() {
  const svg = $('#qrCode').innerHTML;
  const w = window.open('', '_blank', 'width=420,height=560');
  if (!w) return;
  w.document.write(
    `<!doctype html><meta charset="utf-8"><title>QR label</title>` +
      `<style>body{font-family:system-ui,sans-serif;text-align:center;padding:24px}` +
      `.lbl{margin-top:14px;font-size:18px;font-weight:700}svg{width:260px;height:260px}</style>` +
      `<body>${svg}<div class="lbl">${esc(qrCurrent.label)}</div>` +
      `<script>window.onload=function(){window.print()}<\/script>`
  );
  w.document.close();
}

// --- File list -------------------------------------------------------------
// The query params for the current search / filter selection (shared by the
// file list and the CSV export so they always agree on "the current view").
function filterParams() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.code) params.set('code', state.code);
  if (state.productNo) params.set('product', state.productNo);
  if (state.showOld) params.set('revisions', 'all');
  for (const key of Object.keys(AXES)) {
    if (state[key].active !== 'all') params.set(AXES[key].queryKey, state[key].active);
  }
  return params;
}
let loadSeq = 0; // monotonic token so only the latest load updates the view
async function loadFiles() {
  const seq = ++loadSeq;
  // No search and no filter -> show the home shelves instead of a full dump
  if (isBrowsing()) {
    await renderHome(seq);
    return;
  }
  const rows = await api(`/api/files?${filterParams().toString()}`);
  if (seq !== loadSeq) return; // a newer load superseded this one
  lastFiles = rows;
  rememberDocs(lastFiles);
  $('#home').hidden = true;
  $('#results').hidden = false;
  renderFiles(lastFiles);
}

// Sort the current result set client-side and re-render (no refetch)
function sortBy(key) {
  if (state.sort.key === key) {
    state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort = { key, dir: 'asc' };
  }
  renderFiles(lastFiles);
}

function sortFiles(files) {
  const { key, dir } = state.sort;
  if (key === 'relevance') return files; // server already ordered by best match
  const factor = dir === 'asc' ? 1 : -1;
  return [...files].sort((a, b) => {
    let x = a[key];
    let y = b[key];
    if (key === 'size') return ((x || 0) - (y || 0)) * factor;
    x = (x ?? '').toString();
    y = (y ?? '').toString();
    return x.localeCompare(y, undefined, { numeric: true }) * factor;
  });
}

// Active product-code filter banner (set by clicking a product-code chip)
function renderActiveCode() {
  const el = $('#activeCode');
  if (!state.code) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  el.innerHTML = `${t('filteredBy')} <strong>${esc(state.code)}</strong>
    <button id="clearCode" class="ghost">${t('clear')}</button>`;
}
function setCodeFilter(code) {
  state.code = code || '';
  renderActiveCode();
  loadFiles();
}

// --- Dashboard (overview built from the current document set) --------------
async function openDashboard() {
  let files = [];
  try {
    files = await api('/api/files'); // current revisions only
  } catch {
    return;
  }
  $('#dashTotal').textContent = files.length;
  $('#dashDue').textContent = files.filter(isExpired).length;
  $('#dashNoProd').textContent = files.filter((f) => !f.product_no).length;
  $('#dashNoCust').textContent = files.filter((f) => !f.customer_id).length;

  const groupCount = (key) => {
    const m = new Map();
    files.forEach((f) => {
      const k = f[key] || t('none');
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const renderBars = (sel, entries) => {
    const max = Math.max(1, ...entries.map((e) => e[1]));
    $(sel).innerHTML =
      entries
        .map(
          ([k, n]) =>
            `<li><span class="dash-bar-label">${esc(k)}</span>` +
            `<span class="dash-bar"><span class="dash-bar-fill" style="width:${((n / max) * 100).toFixed(0)}%"></span></span>` +
            `<span class="dash-bar-n">${n}</span></li>`
        )
        .join('') || `<li class="muted">-</li>`;
  };
  renderBars('#dashType', groupCount('doc_type_name'));
  renderBars('#dashDept', groupCount('department_name'));
  renderBars('#dashCust', groupCount('customer_name'));

  const recent = [...files]
    .sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1))
    .slice(0, 5);
  $('#dashRecent').innerHTML =
    recent
      .map((f) => `<li>${fmtDay(f.uploaded_at)} — ${esc(f.doc_no || '')} ${esc(f.title)}</li>`)
      .join('') || `<li class="muted">-</li>`;

  $('#dashDialog').showModal();
}

// --- CSV export / import ---------------------------------------------------
// Columns written on export and recognised on import (id is the match key).
const CSV_COLUMNS = [
  'id', 'doc_no', 'revision', 'title', 'doc_type', 'department', 'customer',
  'doc_date', 'model', 'product_name', 'product_no', 'codes', 'uploaded_at', 'uploaded_by',
];
const CSV_FIELD = {
  doc_type: 'doc_type_name', department: 'department_name', customer: 'customer_name',
  uploaded_by: 'uploaded_by_name',
};
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
// Export the current view (all documents when browsing, or the active search /
// filter selection). Fetches fresh so it works on the home screen too.
async function exportCsv() {
  let rows;
  try {
    rows = await api(`/api/files?${filterParams().toString()}`);
  } catch {
    rows = [];
  }
  if (!rows.length) {
    $('#csvResults').innerHTML = `<li class="muted">${t('csvEmpty')}</li>`;
    return;
  }
  const head = CSV_COLUMNS.join(',');
  const body = rows
    .map((f) => CSV_COLUMNS.map((c) => csvCell(f[CSV_FIELD[c] || c])).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + head + '\r\n' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `sop-list-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importCsv(file) {
  const out = $('#csvResults');
  out.innerHTML = `<li>${t('csvImporting')}</li>`;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await api('/api/files/import-csv', { method: 'POST', body: fd });
    const lines = [`<li>${t('csvDone', r.updated, r.total)}</li>`];
    (r.errors || []).forEach((e) => lines.push(`<li class="muted">${esc(e)}</li>`));
    out.innerHTML = lines.join('');
    await Promise.all([loadAxis('customer'), loadFiles()]);
  } catch (err) {
    out.innerHTML = `<li class="muted">${esc(t('csvFail', err.message))}</li>`;
  }
}

// --- ISO document control (DAR / approvals / Master List / distribution) ---
let docCategories = [];
async function loadDocCategories() {
  try {
    docCategories = await api('/api/doc-categories');
  } catch {
    docCategories = [];
  }
}
const STATUS_KEY = {
  draft: 'stDraft', pending_review: 'stPendingReview', pending_approval: 'stPendingApproval',
  master: 'stMaster', void: 'stVoid', cancelled: 'stCancelled',
};
const REQUEST_KEY = {
  new: 'reqNew', change: 'reqChange', additional_copy: 'reqCopy', cancel: 'reqCancel',
};
function statusBadge(status) {
  const key = STATUS_KEY[status] || 'stMaster';
  return `<span class="status-badge st-${status || 'master'}">${t(key)}</span>`;
}
const dateOnly = (iso) => (iso ? String(iso).slice(0, 10) : '—');

// Generic ISO action: POST and return JSON (or null on failure)
async function isoAction(path, body, isForm) {
  const opts = { method: 'POST' };
  if (isForm) opts.body = body;
  else if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  return api(path, opts);
}

// ---- DAR form ----
function fillSelect(sel, items, valueKey, labelKey, placeholder) {
  sel.innerHTML =
    (placeholder ? `<option value="">${esc(placeholder)}</option>` : '') +
    items.map((i) => `<option value="${i[valueKey]}">${esc(i[labelKey])}</option>`).join('');
}
let darNumSeq = 0; // guard so a slow earlier number lookup can't overwrite a newer one
async function updateDarNumber() {
  const my = ++darNumSeq;
  const code = $('#darCategory').value;
  const cat = docCategories.find((c) => c.code === code);
  if (!cat) return;
  $('#darCustWrap').hidden = cat.scope !== 'cust';
  const params = new URLSearchParams({ category: code });
  if (cat.scope === 'dept') params.set('department_id', $('#darDept').value);
  if (cat.scope === 'cust') params.set('customer_id', $('#darCust').value);
  try {
    const r = await api(`/api/next-number?${params}`);
    if (my !== darNumSeq) return; // a newer lookup superseded this one
    $('#darNumber').textContent = r.doc_no || '—';
  } catch {
    if (my === darNumSeq) $('#darNumber').textContent = '—';
  }
}
// Read the attached file and pre-fill the DAR fields (category / dept / title /
// customer). Used both on file-attach and via the explicit "Read file" button.
async function darExtract(manual) {
  const f = $('#darFile').files[0];
  const status = $('#darStatus');
  status.hidden = false;
  status.className = 'extract-status';
  if (!f) {
    if (manual) {
      status.textContent = t('darNoFile');
      status.classList.add('warn');
    } else {
      status.hidden = true;
    }
    return;
  }
  status.textContent = t('reading');
  // Reading is best-effort. On a free/sleeping host the first call can fail
  // (cold start / 503), so try once more after a short wait before giving up.
  const callExtract = async () => {
    const fd = new FormData();
    fd.append('file', f);
    return api('/api/extract', { method: 'POST', body: fd });
  };
  try {
    let meta;
    try {
      meta = await callExtract();
    } catch (e1) {
      await new Promise((r) => setTimeout(r, 1500));
      meta = await callExtract();
    }
    // Category from the document-number prefix (e.g. SOP-QC-0021 -> SOP)
    if (meta.type_code) {
      const cat = docCategories.find((c) => c.code.toUpperCase() === meta.type_code.toUpperCase());
      if (cat) $('#darCategory').value = cat.code;
    }
    const deptId = matchId('department', meta.dept_code); // from the -QC- segment
    if (deptId) $('#darDept').value = deptId;
    const custId = matchId('customer', meta.customer_name); // from the Model line
    if (custId) $('#darCust').value = custId;
    if (meta.title && !$('#darTitleInput').value) $('#darTitleInput').value = meta.title;
    await updateDarNumber(); // refresh number + customer visibility for the new category
    const found = meta.type_code || meta.title || meta.doc_no;
    status.textContent = found ? t('autofilled') : t('noHeader');
    status.classList.add(found ? 'ok' : 'warn');
  } catch (err) {
    status.textContent = t('autoskip', err.message);
    status.classList.add('warn');
  }
}
// Import a completed FDC-001 (Excel) and pre-fill the whole DAR form.
async function importFdc001(file) {
  const status = $('#darImportStatus');
  status.hidden = false;
  status.className = 'extract-status';
  status.textContent = t('reading');
  try {
    const fd = new FormData();
    fd.append('form', file);
    const m = await api('/api/dar/parse-form', { method: 'POST', body: fd });
    if (m.request_type) $('#darRequestType').value = m.request_type;
    if (m.type_code) {
      const cat = docCategories.find((c) => c.code.toUpperCase() === m.type_code.toUpperCase());
      if (cat) $('#darCategory').value = cat.code;
    }
    const deptId = matchId('department', m.dept_code);
    if (deptId) $('#darDept').value = deptId;
    if (m.title) $('#darTitleInput').value = m.title;
    if (m.changed_pages) $('#darPages').value = m.changed_pages;
    if (m.old_rev) $('#darOldRev').value = m.old_rev;
    if (m.new_rev) $('#darNewRev').value = m.new_rev;
    if (m.comment) $('#darComment').value = m.comment;
    if (m.from) $('#darFrom').textContent = m.from;
    if (m.date) $('#darDate').textContent = m.date;
    await updateDarNumber();
    const found = m.doc_no || m.title || m.from;
    status.textContent = found ? t('darImported') : t('noHeader');
    status.classList.add(found ? 'ok' : 'warn');
  } catch (err) {
    status.textContent = t('autoskip', err.message);
    status.classList.add('warn');
  }
}
function openDAR() {
  $('#darForm').reset();
  $('#darError').hidden = true;
  $('#darStatus').hidden = true;
  $('#darImportStatus').hidden = true;
  fillSelect($('#darCategory'), docCategories, 'code', 'code', '');
  // show the label next to code
  $('#darCategory').innerHTML = docCategories
    .map((c) => `<option value="${c.code}">${esc(c.code)} — ${esc(c.label)}</option>`)
    .join('');
  fillSelect($('#darDept'), state.department.items, 'id', 'name', '');
  fillSelect($('#darCust'), state.customer.items, 'id', 'name', t('selectDots'));
  // FDC-001 header fields: requester (current user) + today's date, and the
  // revision row (a new issue is Old "—" / New "00").
  $('#darFrom').textContent = currentUser || '—';
  $('#darDate').textContent = new Date().toISOString().slice(0, 10);
  $('#darOldRev').value = '';
  $('#darNewRev').value = '00';
  updateDarNumber();
  $('#darDialog').showModal();
}
async function submitDAR(e) {
  e.preventDefault();
  const file = $('#darFile').files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('category', $('#darCategory').value);
  fd.append('department_id', $('#darDept').value);
  if (!$('#darCustWrap').hidden) fd.append('customer_id', $('#darCust').value);
  fd.append('title', $('#darTitleInput').value);
  fd.append('detail_of_revision', $('#darDetail').value);
  fd.append('changed_pages', $('#darPages').value);
  fd.append('request_type', $('#darRequestType').value);
  fd.append('description', $('#darComment').value); // FDC-001 "Comment"
  try {
    await isoAction('/api/dar', fd, true);
    $('#darDialog').close();
    if (!$('#home').hidden) renderHome(); // the new doc shows in "All documents"
    openApprovals(); // jump straight to the queue so the demo can approve it
  } catch (err) {
    const el = $('#darError');
    el.textContent = err.message;
    el.hidden = false;
  }
}

// ---- Batch DAR (several documents on one request) ----
let batchCurrent = '';
function openBatch() {
  $('#batchResults').innerHTML = '';
  $('#batchApproveAll').hidden = true;
  batchCurrent = '';
  $('#batchDialog').showModal();
}
async function processBatchDar(files) {
  const list = $('#batchResults');
  list.innerHTML = `<li>${t('batchSubmitting')}</li>`;
  const fd = new FormData();
  fd.append('request_type', $('#batchRequestType').value);
  [...files].forEach((f) => fd.append('files', f));
  try {
    const r = await api('/api/dar/batch', { method: 'POST', body: fd });
    batchCurrent = r.batch;
    const lines = [`<li>${t('batchDone', r.created.length, r.skipped.length)}</li>`];
    r.created.forEach((f) => lines.push(`<li class="scan-hit bulk-ok">${esc(f.doc_no)} — ${esc(f.title)}</li>`));
    r.skipped.forEach((s) => lines.push(`<li class="scan-hit bulk-warn">${esc(t('batchSkip', s.name, s.reason))}</li>`));
    list.innerHTML = lines.join('');
    $('#batchApproveAll').hidden = r.created.length === 0;
    if (!$('#home').hidden) renderHome();
  } catch (err) {
    list.innerHTML = `<li class="scan-hit bulk-warn">${esc(err.message)}</li>`;
  }
}
async function batchApproveAll() {
  if (!batchCurrent) return;
  try {
    const r = await api(`/api/dar/${batchCurrent}/approve-all`, { method: 'POST' });
    $('#batchResults').innerHTML = `<li class="scan-hit bulk-ok">${t('batchApproved', r.approved)}</li>`;
    $('#batchApproveAll').hidden = true;
    batchCurrent = '';
    if (!$('#home').hidden) renderHome();
  } catch {
    /* ignore */
  }
}

// ---- Approval queue ----
async function openApprovals() {
  $('#approvalsDialog').showModal();
  renderApprovals();
}
function approvalItemHtml(f, sub) {
  return `<li class="queue-item${sub ? ' sub' : ''}" data-id="${f.id}">
    <div class="queue-main">
      <span class="doc-no">${esc(f.doc_no || '-')}</span> ${sub ? '' : statusBadge(f.status)}
      <span class="req-type">${t(REQUEST_KEY[f.request_type] || 'reqNew')}</span>
      <div>${esc(f.title)}</div>
      ${f.detail_of_revision ? `<div class="muted">${esc(f.detail_of_revision)}</div>` : ''}
      ${f.reject_comment ? `<div class="reject-note">⤺ ${esc(f.reject_comment)}</div>` : ''}
    </div>
    <div class="queue-actions">
      <button class="btn-link view-doc" data-id="${f.id}" data-name="${esc(f.title)}" data-pdf="${isPdf(f) ? 1 : 0}">👁</button>
      ${f.status === 'draft'
        ? `<button class="primary q-submit" data-id="${f.id}">${t('submitDoc')}</button>`
        : `<button class="primary q-approve" data-id="${f.id}">${t('approve')}</button>
           <button class="ghost q-reject" data-id="${f.id}">${t('reject')}</button>`}
    </div>
  </li>`;
}
async function renderApprovals() {
  const list = $('#approvalsList');
  let docs = [];
  try {
    docs = await api('/api/pending');
  } catch {
    /* ignore */
  }
  if (!docs.length) {
    list.innerHTML = `<li class="muted">${t('noApprovals')}</li>`;
    return;
  }
  // Group documents submitted on the same DAR (dar_batch); singles stand alone
  const groups = new Map();
  docs.forEach((f) => {
    const key = f.dar_batch || `single-${f.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  });
  let html = '';
  for (const items of groups.values()) {
    if (items.length > 1) {
      html += `<li class="queue-group">
        <div class="queue-group-head">
          <strong>${t('docGroup', items.length)}</strong>
          <button class="primary batch-approve" data-batch="${esc(items[0].dar_batch)}">${t('batchApproveAll')}</button>
        </div>
        <ul class="queue-sub-list">${items.map((f) => approvalItemHtml(f, true)).join('')}</ul>
      </li>`;
    } else {
      html += approvalItemHtml(items[0]);
    }
  }
  list.innerHTML = html;
}

// ---- Master List ----
async function openMaster() {
  fillSelect($('#mlDept'), state.department.items, 'id', 'name', t('queueAll'));
  $('#mlCategory').innerHTML =
    `<option value="">${t('queueAll')}</option>` +
    docCategories.map((c) => `<option value="${c.code}">${esc(c.code)}</option>`).join('');
  $('#mlStatus').innerHTML =
    `<option value="">${t('queueAll')}</option>` +
    ['draft', 'pending_review', 'pending_approval', 'master', 'void']
      .map((s) => `<option value="${s}">${t(STATUS_KEY[s])}</option>`)
      .join('');
  $('#masterDialog').showModal();
  renderMaster();
}
async function renderMaster() {
  const params = new URLSearchParams();
  if ($('#mlDept').value) params.set('department', $('#mlDept').value);
  if ($('#mlCategory').value) params.set('category', $('#mlCategory').value);
  if ($('#mlStatus').value) params.set('status', $('#mlStatus').value);
  let docs = [];
  try {
    docs = await api(`/api/master-list?${params}`);
  } catch {
    /* ignore */
  }
  rememberDocs(docs);
  $('#masterRows').innerHTML = docs.length
    ? docs
        .map(
          (f) => `<tr class="master-row" data-id="${f.id}" data-name="${esc(f.title)}" data-pdf="${isPdf(f) ? 1 : 0}">
            <td class="doc-no">${esc(f.doc_no || '-')}</td>
            <td>${esc(f.title)}</td>
            <td>${esc(f.model || '')}</td>
            <td>${f.customer_name ? esc(f.customer_name) : '<span class="muted">-</span>'}</td>
            <td>${esc(f.revision || '')}</td>
            <td>${dateOnly(f.effective_date || f.doc_date)}</td>
            <td>${statusBadge(f.status)}</td>
            <td>${dateOnly(f.next_review_date)}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="8" class="empty">${t('emptyMaster')}</td></tr>`;
}

// ---- Distributions ----
async function openDist() {
  $('#distDialog').showModal();
  renderDist();
}
async function renderDist() {
  let rows = [];
  try {
    rows = await api('/api/distributions');
  } catch {
    /* ignore */
  }
  $('#distList').innerHTML = rows.length
    ? rows
        .map(
          (d) => `<li class="queue-item" data-id="${d.id}">
            <div class="queue-main">
              <span class="doc-no">${esc(d.doc_no || '-')}</span> Rev.${esc(d.revision)}
              → <strong>${esc(d.dept_code)}</strong>
              <div class="muted">${esc(d.title)} · ${dateOnly(d.distributed_at)}</div>
            </div>
            <div class="queue-actions">
              ${d.received
                ? `<span class="status-badge st-master">✓ ${t('received')}</span>`
                : `<button class="primary d-receive" data-id="${d.id}">${t('receive')}</button>`}
            </div>
          </li>`
        )
        .join('')
    : `<li class="muted">${t('noDist')}</li>`;
}

// ---- Viewer ISO panel (status, dates, actions, revision history) ----
function showIsoPanel(doc) {
  const panel = $('#viewIso');
  const workflow = doc && (doc.category || (doc.status && doc.status !== 'master'));
  if (!workflow) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  const s = doc.status;
  let actions = '';
  if (s === 'pending_review' || s === 'pending_approval') {
    actions = `<button class="primary iso-approve">${t('approve')}</button>
               <button class="ghost iso-reject">${t('reject')}</button>`;
  } else if (s === 'draft') {
    actions = `<button class="primary iso-submit">${t('submitDoc')}</button>`;
  } else if (s === 'master') {
    const opts = state.department.items.map((d) => `<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');
    actions = `<select class="iso-dept">${opts}</select>
               <button class="primary iso-distribute">${t('distribute')}</button>
               <button class="ghost iso-revise">${t('revise')}</button>
               <button class="ghost iso-review">${t('annualReview')}</button>`;
  }
  // Electronic approval record (single-stage): the authenticated, timestamped
  // equivalent of the Prepared / Approved signatures.
  const sign = (name, at) =>
    name ? `${esc(name)}${at ? ` · ${dateOnly(at)}` : ''}` : `<span class="muted">${t('apprPending')}</span>`;
  const approvalBlock = `
    <div class="appr-block">
      <div><span class="appr-role">${t('apprPrepared')}</span> ${sign(doc.uploaded_by_name)}</div>
      <div><span class="appr-role">${t('apprApproved')}</span> ${sign(doc.approver, doc.effective_date)}</div>
    </div>`;
  panel.hidden = false;
  panel.innerHTML = `
    <div class="iso-row">
      ${statusBadge(s)}
      <span class="iso-meta">${esc(doc.doc_no || '')} · Rev ${esc(doc.revision || '00')}</span>
      ${doc.effective_date ? `<span class="iso-meta">${t('effLabel')}: ${dateOnly(doc.effective_date)}</span>` : ''}
      ${doc.next_review_date ? `<span class="iso-meta">${t('revwLabel')}: ${dateOnly(doc.next_review_date)}</span>` : ''}
    </div>
    ${approvalBlock}
    <div class="iso-actions">${actions}</div>
    <div id="viewRevs" class="iso-revs"></div>
    <input type="file" id="reviseInput" accept=".pdf,.xls,.xlsx,.doc,.docx" hidden />`;
  loadRevisions(doc.id);
}
async function loadRevisions(id) {
  let revs = [];
  try {
    revs = await api(`/api/files/${id}/revisions`);
  } catch {
    return;
  }
  if (revs.length <= 1) return;
  $('#viewRevs').innerHTML =
    `<div class="iso-revs-title">${t('revHistory')}</div>` +
    `<table class="rev-table"><tbody>` +
    revs
      .map(
        (r) => `<tr>
          <td>Rev ${esc(r.revision)}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${esc(r.changed_pages || '')}</td>
          <td>${esc(r.detail_of_revision || '')}</td>
          <td>${dateOnly(r.effective_date || r.uploaded_at)}</td>
        </tr>`
      )
      .join('') +
    `</tbody></table>`;
}
// Re-open the viewer for a (possibly updated) document id, refreshing its row
async function refreshAndView(id) {
  try {
    const rows = await api(`/api/files?revisions=all`);
    rememberDocs(rows);
  } catch {
    /* ignore */
  }
  const doc = docCache[id];
  if (doc) openView(doc.id, doc.title, isPdf(doc));
}

// --- Settings (manage Types / Departments / Customers) ---------------------
function renderSettings() {
  document.querySelectorAll('.settings-col').forEach((col) => {
    const axis = col.dataset.axis;
    const items = state[axis].items;
    col.querySelector('.settings-list').innerHTML = items.length
      ? items
          .map(
            (c) => `<li data-id="${c.id}" data-axis="${axis}" data-name="${esc(c.name)}">
              <span class="s-name">${esc(c.name)}</span>
              <span class="s-count" title="files">${c.file_count}</span>
              <button type="button" class="btn-link s-rename">${t('rename')}</button>
              <button type="button" class="btn-link danger s-del">${t('deleteW')}</button>
            </li>`
          )
          .join('')
      : `<li class="muted">${t('noneYet')}</li>`;
  });
}

// Recent access log (shown in Settings)
async function renderLogs() {
  const tbody = $('#logRows');
  try {
    const logs = await api('/api/logs');
    tbody.innerHTML = logs.length
      ? logs
          .map(
            (l) => `<tr>
              <td>${fmtDateTime(l.at)}</td>
              <td>${esc(l.username || '-')}</td>
              <td>${esc(l.action)}</td>
              <td>${esc(l.doc_no || '')} ${esc(l.title || '')}</td>
            </tr>`
          )
          .join('')
      : `<tr><td colspan="4" class="empty">${t('logNone')}</td></tr>`;
  } catch {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">${t('logNone')}</td></tr>`;
  }
}

// After an add/rename/delete: refresh that axis everywhere
async function afterSettingsChange(axis) {
  await loadAxis(axis); // updates state + sidebar + upload selects
  renderSettings();
  await loadFiles(); // names may have changed in the table
}

function renderSortArrows() {
  document.querySelectorAll('th.sortable').forEach((th) => {
    const arrow = th.querySelector('.arrow');
    if (!arrow) return;
    const active = th.dataset.sort === state.sort.key;
    arrow.textContent = active ? (state.sort.dir === 'asc' ? '▲' : '▼') : '';
    arrow.className = 'arrow' + (active ? ' ' + state.sort.dir : '');
  });
}

function renderFiles(files) {
  renderSortArrows();
  files = sortFiles(files);
  if (state.expiredOnly) files = files.filter(isExpired);
  const dueCount = files.reduce((n, f) => n + (isExpired(f) ? 1 : 0), 0);
  $('#listInfo').textContent = t('files', files.length) + (dueCount ? t('due', dueCount) : '');
  const tbody = $('#fileRows');
  if (files.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty">${t('noFiles')}</td></tr>`;
    return;
  }
  const q = state.q;
  tbody.innerHTML = files
    .map(
      (f) => `<tr class="${f.is_current ? '' : 'superseded'}">
        <td class="icon" title="${esc(f.doc_type_name || '')}">${iconFor(f)}</td>
        <td>
          <div class="doc-no">${f.doc_no ? highlight(f.doc_no, q) : '<span class="muted">-</span>'}</div>
          ${f.revision ? `<div class="file-orig">Rev.${esc(f.revision)}</div>` : ''}
          ${f.doc_date ? `<div class="file-orig">${esc(f.doc_date)}</div>` : ''}
          ${
            f.is_current
              ? f.revision_count > 1
                ? `<span class="rev-badge current">${t('current', f.revision_count)}</span>`
                : ''
              : `<span class="rev-badge old">${t('superseded')}</span>`
          }
          ${isExpired(f) ? `<span class="rev-badge due">${t('badgeDue')}</span>` : ''}
        </td>
        <td>
          <button class="file-title link-title view-file" data-id="${f.id}" data-name="${esc(f.title)}" data-pdf="${isPdf(f) ? 1 : 0}">${highlight(f.title, q)}</button>
          ${f.product_name ? `<div class="file-desc">${t('productName')}: ${highlight(f.product_name, q)}</div>` : ''}
          ${codeChips(f)}
          ${f.snippet ? `<div class="file-snippet">…${highlight(f.snippet, q)}… <span class="muted">(${t('inText')})</span></div>` : ''}
          ${f.description ? `<div class="file-desc">${esc(f.description)}</div>` : ''}
          <div class="file-orig">${esc(f.original_name)}</div>
        </td>
        <td>${f.doc_type_name ? `<span class="tag">${esc(f.doc_type_name)}</span>` : '-'}</td>
        <td>${f.department_name ? esc(f.department_name) : '-'}</td>
        <td>${f.customer_name ? esc(f.customer_name) : '<span class="muted">-</span>'}</td>
        <td>${fmtSize(f.size)}</td>
        <td>${fmtDay(f.uploaded_at)}</td>
        <td>${esc(f.uploaded_by_name || '-')}</td>
        <td class="actions">
          <button class="btn-link fav-btn${f.favorited ? ' on' : ''}" data-id="${f.id}" title="★">${f.favorited ? '★' : '☆'}</button>
          <a class="btn-link" href="/api/files/${f.id}/download">${t('download')}</a>
          <button class="btn-link danger del-file" data-id="${f.id}">${t('del')}</button>
        </td>
      </tr>`
    )
    .join('');
}

// --- Events ----------------------------------------------------------------
function bindAxisEvents(key) {
  const axis = AXES[key];

  // Select / delete an axis item (delegated)
  $(axis.listEl).addEventListener('click', async (e) => {
    const del = e.target.closest('.del-item');
    if (del) {
      e.stopPropagation();
      if (!confirm(t('confirmDelAxis', axis.label))) return;
      try {
        await api(`${axis.api}/${del.dataset.id}`, { method: 'DELETE' });
      } catch (err) {
        alert(err.message);
        return;
      }
      if (String(state[key].active) === del.dataset.id) state[key].active = 'all';
      await loadAxis(key);
      await loadFiles();
      return;
    }
    const item = e.target.closest('.filter-item');
    if (item) setActive(key, item.dataset.id);
  });
}

function bindAddForm(formSel, inputSel, key) {
  $(formSel).addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $(inputSel).value.trim();
    if (!name) return;
    try {
      await api(AXES[key].api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      $(inputSel).value = '';
      await loadAxis(key);
    } catch (err) {
      alert(err.message);
    }
  });
}

function bindEvents() {
  // Language toggle (EN / TH)
  $('#langToggle').addEventListener('click', () => applyLang(LANG === 'en' ? 'th' : 'en'));

  // Collapse / expand the sidebar filter sections (collapsed by default)
  document.querySelectorAll('.axis-toggle').forEach((h) => {
    h.addEventListener('click', () => h.closest('.axis-section').classList.toggle('collapsed'));
  });

  bindAxisEvents('type');
  bindAxisEvents('department');
  bindAxisEvents('customer');
  bindAddForm('#typeForm', '#newType', 'type');
  bindAddForm('#departmentForm', '#newDepartment', 'department');
  bindAddForm('#customerForm', '#newCustomer', 'customer');

  // Search (as you type) — instant typeahead, ordered by best match
  let timer;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(timer);
    state.q = e.target.value.trim();
    if (state.q) state.sort = { key: 'relevance', dir: 'desc' };
    timer = setTimeout(loadFiles, 150);
  });
  // Enter in the search box opens the top (best-match) result. Defer the open
  // to the next tick and preventDefault, so this same Enter keystroke doesn't
  // "fall through" and activate the first button in the freshly-opened viewer.
  $('#search').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const top = sortFiles(state.expiredOnly ? lastFiles.filter(isExpired) : lastFiles)[0];
    if (top) setTimeout(() => openView(top.id, top.title, isPdf(top)), 0);
  });
  // Press "/" anywhere (outside a field) to jump to the search box
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    e.preventDefault();
    $('#search').focus();
  });

  // Sidebar Product No. filter (partial match, debounced)
  let prodTimer;
  $('#productFilter').addEventListener('input', (e) => {
    clearTimeout(prodTimer);
    state.productNo = e.target.value;
    prodTimer = setTimeout(loadFiles, 250);
  });

  // Sort by clicking a column header
  document.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => sortBy(th.dataset.sort));
  });

  // Show / hide superseded (old) revisions
  $('#showOld').addEventListener('change', (e) => {
    state.showOld = e.target.checked;
    loadFiles();
  });

  // Show only documents due for review (>2 years) — client-side filter
  $('#expiredOnly').addEventListener('change', (e) => {
    state.expiredOnly = e.target.checked;
    renderFiles(lastFiles);
  });

  // Click a product-code chip -> filter the list by that exact code
  $('#fileRows').addEventListener('click', (e) => {
    const chip = e.target.closest('.code-chip');
    if (chip) {
      setCodeFilter(chip.dataset.code);
      return;
    }
    const fav = e.target.closest('.fav-btn');
    if (fav) {
      toggleFavorite(fav.dataset.id);
      return;
    }
    const view = e.target.closest('.view-file');
    if (view) openView(view.dataset.id, view.dataset.name, view.dataset.pdf === '1');
  });

  // Home shelves: open a card, or toggle its ★
  $('#home').addEventListener('click', (e) => {
    const fav = e.target.closest('.fav-btn');
    if (fav) {
      e.stopPropagation();
      toggleFavorite(fav.dataset.id);
      return;
    }
    const card = e.target.closest('.doc-card');
    if (card) openView(card.dataset.id, card.dataset.name, card.dataset.pdf === '1');
  });

  $('#qrClose').addEventListener('click', () => $('#qrDialog').close());
  $('#qrPrint').addEventListener('click', printQr);

  // In-app preview: close via button, Escape, or clicking the backdrop
  $('#viewFav').addEventListener('click', () => currentDoc && toggleFavorite(currentDoc.id));
  $('#viewQr').addEventListener('click', () => {
    if (!currentDoc) return;
    const label = [currentDoc.doc_no, currentDoc.title].filter(Boolean).join(' — ');
    openQr(currentDoc.doc_no || currentDoc.title, label);
  });
  $('#viewPrint').addEventListener('click', printDoc);
  $('#viewClose').addEventListener('click', closeView);
  $('#viewDialog').addEventListener('cancel', (e) => {
    e.preventDefault();
    closeView();
  });
  $('#viewDialog').addEventListener('click', (e) => {
    if (e.target === $('#viewDialog')) closeView(); // clicked outside the content
  });
  // Clear the active product-code filter
  $('#activeCode').addEventListener('click', (e) => {
    if (e.target.closest('#clearCode')) setCodeFilter('');
  });

  // Delete file (delegated)
  $('#fileRows').addEventListener('click', async (e) => {
    const del = e.target.closest('.del-file');
    if (!del) return;
    if (!confirm(t('confirmDelFile'))) return;
    await api(`/api/files/${del.dataset.id}`, { method: 'DELETE' });
    await loadFiles();
    await Promise.all([loadAxis('type'), loadAxis('department'), loadAxis('customer')]);
  });

  // --- Barcode / product-number lookup (inspection station) ---------------
  const scanDialog = $('#scanDialog');
  const openInline = (id) => window.open(`/api/files/${id}/download?inline=1`, '_blank');
  const setScanStatus = (text, cls) => {
    const s = $('#scanStatus');
    s.hidden = false;
    s.className = 'extract-status' + (cls ? ' ' + cls : '');
    s.textContent = text;
  };

  // Look up a scanned/typed code and open the matching spec
  async function doLookup(code) {
    code = (code || '').trim();
    const results = $('#scanResults');
    results.innerHTML = '';
    if (!code) return;
    setScanStatus(t('searching', code), '');
    try {
      const files = await api(`/api/lookup?code=${encodeURIComponent(code)}`);
      if (files.length === 0) {
        setScanStatus(t('notFound', code), 'warn');
      } else if (files.length === 1) {
        setScanStatus(t('opened', files[0].doc_no || files[0].title), 'ok');
        openInline(files[0].id);
      } else {
        setScanStatus(t('matches', files.length), 'ok');
        results.innerHTML = files
          .map(
            (f) => `<li class="scan-hit" data-id="${f.id}">
              <span class="tag">${esc(f.doc_type_name || '')}</span>
              <span class="doc-no">${esc(f.doc_no || '-')}</span>
              <span>${esc(f.title)}</span>
              ${f.product_no ? `<span class="file-orig">${esc(f.product_no)}</span>` : ''}
            </li>`
          )
          .join('');
      }
    } catch (err) {
      setScanStatus(`${err.message}`, 'warn');
    }
  }

  // Camera scanning via ZXing (QR / Data Matrix / 2D / 1D barcodes)
  let codeReader = null;
  async function startCamera() {
    if (!window.ZXing) {
      setScanStatus(t('cameraNoLoad'), 'warn');
      return;
    }
    const video = $('#scanVideo');
    try {
      codeReader = new ZXing.BrowserMultiFormatReader();
      video.hidden = false;
      setScanStatus(t('pointCamera'), '');
      const onResult = (result) => {
        if (!result) return;
        const code = result.getText();
        $('#scanInput').value = code;
        stopCamera();
        doLookup(code);
      };
      // Prefer the rear camera on phones/tablets; fall back to the default
      try {
        await codeReader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          video,
          onResult
        );
      } catch {
        await codeReader.decodeFromVideoDevice(null, video, onResult);
      }
    } catch (err) {
      setScanStatus(t('cameraErr', err.message || err), 'warn');
      stopCamera();
    }
  }
  function stopCamera() {
    if (codeReader) {
      try {
        codeReader.reset();
      } catch {
        /* ignore */
      }
      codeReader = null;
    }
    $('#scanVideo').hidden = true;
  }

  $('#scanOpen').addEventListener('click', () => {
    $('#scanInput').value = '';
    $('#scanResults').innerHTML = '';
    $('#scanStatus').hidden = true;
    scanDialog.showModal();
    $('#scanInput').focus();
    startCamera(); // start the camera straight away (no extra click)
  });
  $('#scanClose').addEventListener('click', () => scanDialog.close());
  scanDialog.addEventListener('close', stopCamera); // stop camera however it closes

  $('#scanResults').addEventListener('click', (e) => {
    const li = e.target.closest('.scan-hit');
    if (li) openInline(li.dataset.id);
  });

  $('#scanForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // keep the dialog open for the next scan
    const code = $('#scanInput').value.trim();
    await doLookup(code);
    $('#scanInput').value = '';
    $('#scanInput').focus();
  });

  // --- Manage menu (holds everything that isn't "finding a document") -----
  const adminDialog = $('#adminDialog');
  const closeAdmin = () => adminDialog.close();
  $('#adminOpen').addEventListener('click', () => adminDialog.showModal());
  $('#adminClose').addEventListener('click', closeAdmin);

  // --- ISO document control -----------------------------------------------
  $('#darOpen').addEventListener('click', () => { closeAdmin(); openDAR(); });
  $('#batchOpen').addEventListener('click', () => { closeAdmin(); openBatch(); });
  $('#approvalsOpen').addEventListener('click', () => { closeAdmin(); openApprovals(); });
  // Master List + single Upload are kept in the code but removed from the menu
  $('#masterOpen')?.addEventListener('click', () => { closeAdmin(); openMaster(); });
  $('#distOpen').addEventListener('click', () => { closeAdmin(); openDist(); });

  // DAR form
  $('#darCancel').addEventListener('click', () => $('#darDialog').close());
  $('#darForm').addEventListener('submit', submitDAR);
  ['#darCategory', '#darDept', '#darCust'].forEach((sel) =>
    $(sel).addEventListener('change', updateDarNumber)
  );
  // Read the attached document and pre-fill category / department / title /
  // customer — runs automatically on attach and on the explicit "Read file" button.
  $('#darFile').addEventListener('change', () => darExtract());
  $('#darRead').addEventListener('click', () => darExtract(true));
  // Import a filled FDC-001 (Excel) to auto-fill the form
  $('#darFormFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) importFdc001(f);
    e.target.value = '';
  });

  // Batch DAR (multiple documents on one request)
  $('#batchClose').addEventListener('click', () => $('#batchDialog').close());
  $('#batchApproveAll').addEventListener('click', batchApproveAll);
  $('#batchInput').addEventListener('change', (e) => {
    if (e.target.files.length) processBatchDar(e.target.files);
    e.target.value = '';
  });
  const bdrop = $('#batchDrop');
  ['dragover', 'dragenter'].forEach((ev) =>
    bdrop.addEventListener(ev, (e) => { e.preventDefault(); bdrop.classList.add('drag'); })
  );
  ['dragleave', 'dragend'].forEach((ev) => bdrop.addEventListener(ev, () => bdrop.classList.remove('drag')));
  bdrop.addEventListener('drop', (e) => {
    e.preventDefault();
    bdrop.classList.remove('drag');
    if (e.dataTransfer.files.length) processBatchDar(e.dataTransfer.files);
  });

  // Approval queue (delegated)
  $('#approvalsClose').addEventListener('click', () => $('#approvalsDialog').close());
  const afterQueueAction = () => {
    renderApprovals();
    if (!$('#home').hidden) renderHome(); // status changes show in "All documents"
  };
  $('#approvalsList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('batch-approve')) {
      await api(`/api/dar/${btn.dataset.batch}/approve-all`, { method: 'POST' });
      afterQueueAction();
    } else if (btn.classList.contains('view-doc')) {
      openView(id, btn.dataset.name, btn.dataset.pdf === '1');
    } else if (btn.classList.contains('q-approve')) {
      await isoAction(`/api/files/${id}/approve`);
      afterQueueAction();
    } else if (btn.classList.contains('q-submit')) {
      await isoAction(`/api/files/${id}/submit`);
      afterQueueAction();
    } else if (btn.classList.contains('q-reject')) {
      const comment = prompt(t('rejectPrompt'), '');
      if (comment === null) return;
      await isoAction(`/api/files/${id}/reject`, { comment });
      afterQueueAction();
    }
  });

  // Master List
  $('#masterClose').addEventListener('click', () => $('#masterDialog').close());
  ['#mlDept', '#mlCategory', '#mlStatus'].forEach((sel) =>
    $(sel).addEventListener('change', renderMaster)
  );
  $('#masterRows').addEventListener('click', (e) => {
    const tr = e.target.closest('.master-row');
    if (tr) openView(tr.dataset.id, tr.dataset.name, tr.dataset.pdf === '1');
  });

  // Distributions
  $('#distClose').addEventListener('click', () => $('#distDialog').close());
  $('#distList').addEventListener('click', async (e) => {
    const btn = e.target.closest('.d-receive');
    if (!btn) return;
    await isoAction(`/api/distributions/${btn.dataset.id}/receive`);
    renderDist();
  });

  // Viewer ISO panel actions (delegated)
  $('#viewIso').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn || !currentDoc) return;
    const id = currentDoc.id;
    if (btn.classList.contains('iso-approve')) {
      await isoAction(`/api/files/${id}/approve`);
      refreshAndView(id);
    } else if (btn.classList.contains('iso-submit')) {
      await isoAction(`/api/files/${id}/submit`);
      refreshAndView(id);
    } else if (btn.classList.contains('iso-reject')) {
      const comment = prompt(t('rejectPrompt'), '');
      if (comment === null) return;
      await isoAction(`/api/files/${id}/reject`, { comment });
      refreshAndView(id);
    } else if (btn.classList.contains('iso-distribute')) {
      const dept = $('#viewIso .iso-dept').value;
      await isoAction(`/api/files/${id}/distribute`, { dept_code: dept });
      // Open the controlled-print copy so the blue watermark is visible
      window.open(`/api/files/${id}/download?distribute=${encodeURIComponent(dept)}&inline=1`, '_blank');
    } else if (btn.classList.contains('iso-review')) {
      await isoAction(`/api/files/${id}/review`);
      refreshAndView(id);
    } else if (btn.classList.contains('iso-revise')) {
      $('#reviseInput').click();
    }
  });
  $('#viewIso').addEventListener('change', async (e) => {
    if (!e.target.matches('#reviseInput') || !currentDoc) return;
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('detail_of_revision', 'Revised via viewer');
    try {
      const created = await isoAction(`/api/files/${currentDoc.id}/revise`, fd, true);
      docCache[created.id] = created;
      openView(created.id, created.title, isPdf(created)); // open the new revision
    } catch (err) {
      alert(err.message);
    }
  });

  // --- Dashboard ----------------------------------------------------------
  $('#dashOpen').addEventListener('click', () => {
    closeAdmin();
    openDashboard();
  });
  $('#dashClose').addEventListener('click', () => $('#dashDialog').close());

  // --- CSV export / import ------------------------------------------------
  $('#csvOpen').addEventListener('click', () => {
    closeAdmin();
    $('#csvResults').innerHTML = '';
    $('#csvDialog').showModal();
  });
  $('#csvClose').addEventListener('click', () => $('#csvDialog').close());
  $('#csvExport').addEventListener('click', exportCsv);
  $('#csvInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importCsv(file);
    e.target.value = '';
  });

  // --- Settings (manage Types / Departments / Customers) ------------------
  const settingsDialog = $('#settingsDialog');
  $('#settingsOpen').addEventListener('click', () => {
    closeAdmin();
    renderSettings();
    renderLogs();
    settingsDialog.showModal();
  });
  $('#settingsClose').addEventListener('click', () => settingsDialog.close());
  // Rename / delete (delegated)
  settingsDialog.addEventListener('click', async (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const axis = li.dataset.axis;
    const id = li.dataset.id;
    if (e.target.closest('.s-rename')) {
      const name = prompt(t('promptName'), li.dataset.name);
      if (name === null) return;
      const v = name.trim();
      if (!v || v === li.dataset.name) return;
      try {
        await api(`${AXES[axis].api}/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: v }),
        });
      } catch (err) {
        alert(err.message);
        return;
      }
      await afterSettingsChange(axis);
    } else if (e.target.closest('.s-del')) {
      if (!confirm(t('confirmDelAxis', AXES[axis].label))) return;
      try {
        await api(`${AXES[axis].api}/${id}`, { method: 'DELETE' });
      } catch (err) {
        alert(err.message);
        return;
      }
      await afterSettingsChange(axis);
    }
  });
  // Add (each column's form)
  document.querySelectorAll('.settings-col .settings-add').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const axis = form.closest('.settings-col').dataset.axis;
      const input = form.querySelector('input');
      const v = input.value.trim();
      if (!v) return;
      try {
        await api(AXES[axis].api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: v }),
        });
      } catch (err) {
        alert(err.message);
        return;
      }
      input.value = '';
      await afterSettingsChange(axis);
    });
  });

  // --- Bulk upload --------------------------------------------------------
  const bulkDialog = $('#bulkDialog');
  $('#bulkOpen').addEventListener('click', () => {
    closeAdmin();
    $('#bulkResults').innerHTML = '';
    bulkDialog.showModal();
  });
  $('#bulkClose').addEventListener('click', () => bulkDialog.close());
  $('#bulkInput').addEventListener('change', (e) => {
    if (e.target.files.length) processBulk(e.target.files);
    e.target.value = '';
  });
  const drop = $('#bulkDrop');
  ['dragover', 'dragenter'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('drag');
    })
  );
  ['dragleave', 'dragend'].forEach((ev) =>
    drop.addEventListener(ev, () => drop.classList.remove('drag'))
  );
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('drag');
    if (e.dataTransfer.files.length) processBulk(e.dataTransfer.files);
  });

  // Upload modal
  const dialog = $('#uploadDialog');
  $('#uploadOpen')?.addEventListener('click', () => {
    closeAdmin();
    $('#uploadForm').reset();
    $('#uploadError').hidden = true;
    $('#extractStatus').hidden = true;
    // Preselect whichever axes are currently filtered
    for (const key of Object.keys(AXES)) {
      if (state[key].active !== 'all') $(AXES[key].uploadEl).value = state[key].active;
    }
    dialog.showModal();
  });
  $('#uploadCancel').addEventListener('click', () => dialog.close());

  // Auto-select Type & Department from a document number (e.g. SOP-QC-0021)
  const matchAxisByName = (key, name) => {
    if (!name) return;
    const hit = state[key].items.find(
      (c) => c.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (hit) $(AXES[key].uploadEl).value = hit.id;
  };
  const applyDocNo = () => {
    const parts = $('#docNo').value.split('-');
    matchAxisByName('type', parts[0]);
    matchAxisByName('department', parts[1]);
  };
  $('#docNo').addEventListener('input', applyDocNo);

  // Auto-extract header fields when a file is chosen (experimental, best-effort)
  $('#file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const status = $('#extractStatus');
    status.hidden = false;
    status.className = 'extract-status';
    status.textContent = t('reading');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const meta = await api('/api/extract', { method: 'POST', body: fd });
      // Only fill empty fields so we never clobber what the user typed
      const setIf = (sel, val) => {
        if (val && !$(sel).value) $(sel).value = val;
      };
      setIf('#docNo', meta.doc_no);
      setIf('#title', meta.title);
      setIf('#revision', meta.revision);
      setIf('#docDate', meta.doc_date);
      setIf('#productName', meta.product_name);
      setIf('#model', meta.model);
      setIf('#productNo', meta.product_no);
      // Customer comes from the Model prefix (e.g. "TOTO : …") — select if known
      if (!$('#uploadCustomer').value) matchAxisByName('customer', meta.customer_name);
      applyDocNo();
      const found = meta.doc_no || meta.title || meta.revision;
      status.textContent = found ? t('autofilled') : t('noHeader');
      status.classList.add(found ? 'ok' : 'warn');
    } catch (err) {
      status.textContent = t('autoskip', err.message);
      status.classList.add('warn');
    }
  });

  $('#uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = $('#file');
    if (!fileInput.files.length) return;
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    fd.append('title', $('#title').value);
    fd.append('description', $('#description').value);
    fd.append('doc_type_id', $('#uploadType').value);
    fd.append('department_id', $('#uploadDepartment').value);
    fd.append('customer_id', $('#uploadCustomer').value);
    fd.append('doc_no', $('#docNo').value);
    fd.append('revision', $('#revision').value);
    fd.append('doc_date', $('#docDate').value);
    fd.append('product_name', $('#productName').value);
    fd.append('model', $('#model').value);
    fd.append('product_no', $('#productNo').value);
    try {
      try {
        await api('/api/files', { method: 'POST', body: fd });
      } catch (err) {
        if (err.data && err.data.duplicate && confirm(t('confirmDup'))) {
          fd.append('force', '1');
          await api('/api/files', { method: 'POST', body: fd });
        } else {
          throw err;
        }
      }
      dialog.close();
      await loadFiles();
      await Promise.all([loadAxis('type'), loadAxis('department'), loadAxis('customer')]);
    } catch (err) {
      const el = $('#uploadError');
      el.textContent = err.message;
      el.hidden = false;
    }
  });
}

// --- Bootstrap --------------------------------------------------------------
async function init() {
  try {
    const { user, demo } = await api('/api/me');
    currentUser = user.display_name || user.username;
    $('#me').textContent = currentUser;
    // Demo mode auto-signs-in, so the Sign out button would be confusing — hide it
    if (demo) {
      const out = document.querySelector('form[action="/logout"]');
      if (out) out.hidden = true;
    }
  } catch {
    return; // api() already redirected on 401
  }
  bindEvents();
  applyLang(); // apply the saved language to static labels
  api('/api/version')
    .then(({ version }) => {
      $('#appVer').textContent = `v${version}`;
    })
    .catch(() => {});
  // Register the service worker (PWA install + cached app shell). Best-effort.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  await Promise.all([loadAxis('type'), loadAxis('department'), loadAxis('customer'), loadDocCategories()]);
  await loadFiles();
}

init();
