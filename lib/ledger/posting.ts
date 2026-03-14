export type Posting = {
  accountId: string;
  direction: "debit" | "credit";
  amountMinor: number;
  currency: string;
};

export const assertBalancedPostings = (postings: Posting[]): void => {
  const debitTotal = postings
    .filter((posting) => posting.direction === "debit")
    .reduce((sum, posting) => sum + posting.amountMinor, 0);

  const creditTotal = postings
    .filter((posting) => posting.direction === "credit")
    .reduce((sum, posting) => sum + posting.amountMinor, 0);

  if (debitTotal !== creditTotal) {
    throw new Error("Unbalanced postings are not allowed");
  }
};
