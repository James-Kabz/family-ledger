const TRANSFER_PREFIX = "Transfer to: ";

export function isTransferRecordTitle(title: string) {
  return title.trim().toLowerCase().startsWith(TRANSFER_PREFIX.toLowerCase());
}

export function toTransferRecordTitle(recipientOrLabel: string) {
  const cleaned = recipientOrLabel.trim();
  return `${TRANSFER_PREFIX}${cleaned}`;
}

export function getTransferLabelFromTitle(title: string) {
  if (!isTransferRecordTitle(title)) return title;
  return title.slice(TRANSFER_PREFIX.length).trim() || "Recipient";
}
