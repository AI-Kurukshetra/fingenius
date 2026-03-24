export type Posting = {
  accountId: string;
  direction: "debit" | "credit";
  amountMinor: number;
  currency: string;
};

export const assertBalancedPostings = (postings: Posting[]): void => {
  let balance = 0;
  for (const posting of postings) {
    balance += posting.direction === "debit" ? posting.amountMinor : -posting.amountMinor;
  }
  if (balance !== 0) {
    throw new Error("Unbalanced postings are not allowed");
  }
};
