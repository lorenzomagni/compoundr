import type { Repositories } from "../../../src/server/db/repositories";
import type { EdgarFundamental } from "../../../src/server/providers/edgar";

// Ten fiscal years of plausible Coca-Cola-like figures, used by both service test files.
export const YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

export function edgarRowsFor(years: number[] = YEARS): EdgarFundamental[] {
  return years.flatMap((fy) => {
    const common = { fiscalYear: fy, form: "10-K", filedAt: `${fy + 1}-02-15` };
    return [
      { ...common, concept: "NetIncomeLoss", value: 8000 + (fy - 2015) * 100 },
      { ...common, concept: "StockholdersEquity", value: 20000 },
      { ...common, concept: "OperatingIncomeLoss", value: 11000 },
      { ...common, concept: "Revenues", value: 45000 },
      { ...common, concept: "LongTermDebtNoncurrent", value: 30000 },
      { ...common, concept: "NetCashProvidedByUsedInOperatingActivities", value: 10000 },
      { ...common, concept: "PaymentsToAcquirePropertyPlantAndEquipment", value: 1000 },
      { ...common, concept: "DepreciationDepletionAndAmortization", value: 1000 },
      { ...common, concept: "CommonStockDividendsPerShareDeclared", value: 1.8 },
      { ...common, concept: "WeightedAverageNumberOfDilutedSharesOutstanding", value: 4300 },
    ];
  });
}

export function seedKo(repos: Repositories, opts: { dividends: { exDate: string; amount: number }[] }) {
  repos.companies.upsert({ ticker: "KO", name: "Coca-Cola", cik: "21344", inSp500: true });
  repos.fundamentals.upsertMany(edgarRowsFor().map((r) => ({ ticker: "KO", ...r })));
  repos.prices.upsertMany("KO", [
    { date: "2024-06-03", close: 60 },
    { date: "2024-12-30", close: 62 },
  ], "fmp");
  repos.dividends.upsertMany("KO", opts.dividends, "fmp");
}
