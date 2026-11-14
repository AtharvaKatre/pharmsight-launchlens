import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { scenariosApi } from "../../api/scenarios";
import { parseCsv } from "../../lib/csv";
import { downloadCsv } from "../../lib/download";
import { RESULT_CSV_COLUMNS } from "./csvResults";
import { forecast, STANDARD_SCENARIOS } from "../../test/fixtures";
import { renderAsUser } from "../../test/render";
import { DashboardPage } from "./DashboardPage";

vi.mock("../../api/scenarios", () => ({
  scenariosApi: { list: vi.fn(), forecast: vi.fn() },
}));
vi.mock("../../lib/download", () => ({ downloadCsv: vi.fn() }));

const api = vi.mocked(scenariosApi);
const SCALE: Record<number, number> = { 1: 1, 2: 1.5, 3: 0.5 };

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue(STANDARD_SCENARIOS);
  api.forecast.mockImplementation(async (id) => forecast(id, SCALE[id]));
});

async function renderDashboard(role: "FORECASTER" | "BRAND_LEAD" = "FORECASTER") {
  renderAsUser(<DashboardPage />, role);
  await screen.findByRole("heading", { name: "Patient funnel" });
}

const kpi = (label: RegExp) => screen.getByText(label).closest(".kpi") as HTMLElement;

describe("DashboardPage", () => {
  it("loads a forecast for every scenario", async () => {
    await renderDashboard();
    expect(api.forecast).toHaveBeenCalledTimes(3);
    const legend = screen.getByRole("list", { name: "Scenarios" });
    expect(within(legend).getAllByRole("button").map((b) => b.textContent)).toEqual(["Base", "Upside", "Downside"]);
  });

  it("defaults to Base and the final forecast year", async () => {
    await renderDashboard();
    expect(screen.getByLabelText("Scenario")).toHaveValue("1");
    expect(screen.getByRole("button", { name: "2036" })).toHaveAttribute("aria-pressed", "true");
    expect(kpi(/Net revenue · 2036/)).toHaveTextContent("$315M");
  });

  it("shows KPI cards for the selected year", async () => {
    await renderDashboard();
    await userEvent.click(screen.getByRole("button", { name: "2027" }));

    expect(kpi(/Net revenue · 2027/)).toHaveTextContent("$28.8M");
    expect(kpi(/Net revenue · 2027/)).toHaveTextContent("Base case scenario");
    expect(kpi(/Patients on drug · 2027/)).toHaveTextContent("4,800");
    expect(kpi(/Patients on drug · 2027/)).toHaveTextContent("3,840 compliant");
    expect(kpi(/Peak annual net revenue/)).toHaveTextContent("Reached in 2036");
  });

  it("shows every funnel stage for the selected scenario and year", async () => {
    await renderDashboard();
    await userEvent.click(screen.getByRole("button", { name: "2027" }));

    const funnel = screen.getByRole("heading", { name: "Patient funnel" }).closest("section")!;
    expect(funnel).toHaveTextContent("Base · 2027");
    const stages = within(funnel).getAllByRole("listitem").map((li) => [
      li.querySelector(".funnel__label")!.textContent,
      li.querySelector(".funnel__value")!.textContent,
    ]);
    expect(stages).toEqual([
      ["Prevalent patients", "2,000,000"],
      ["Diagnosed", "1,200,000"],
      ["Drug-treated", "600,000"],
      ["Eligible for drug class", "240,000"],
      ["Peak brand patients", "48,000"],
      ["Patients on drug", "4,800"],
      ["Compliant patients", "3,840"],
    ]);
    expect(funnel).toHaveTextContent("Gross revenue$38,400,000");
    expect(funnel).toHaveTextContent("Gross-to-net−25%");
    expect(funnel).toHaveTextContent("Net revenue$28,800,000");
  });

  it("compares the focused scenario to Base", async () => {
    await renderDashboard();
    await userEvent.selectOptions(screen.getByLabelText("Scenario"), "2");

    expect(kpi(/Net revenue · 2036/)).toHaveTextContent("+50% vs Base");
    expect(screen.getByRole("heading", { name: "Patient funnel" }).closest("section")).toHaveTextContent("Upside · 2036");
  });

  it("offers a table view of net revenue by scenario", async () => {
    await renderDashboard();
    await userEvent.click(screen.getByRole("button", { name: "Table" }));

    const table = screen.getByRole("table");
    const row2027 = within(table).getByRole("rowheader", { name: "2027" }).closest("tr")!;
    expect(within(row2027).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "$28,800,000",
      "$43,200,000",
      "$14,400,000",
    ]);
  });

  it("exports the full funnel and revenue for every scenario as CSV", async () => {
    await renderDashboard("BRAND_LEAD");
    await userEvent.click(screen.getByRole("button", { name: "Export results CSV" }));

    expect(downloadCsv).toHaveBeenCalledOnce();
    const [filename, csv] = vi.mocked(downloadCsv).mock.calls[0];
    expect(filename).toMatch(/^launchlens-forecast-results-\d{4}-\d{2}-\d{2}\.csv$/);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...RESULT_CSV_COLUMNS]);
    expect(rows).toHaveLength(1 + 3 * 10);
    expect(rows.slice(1).map((r) => r[0])).toEqual([
      ...Array(10).fill("Base"),
      ...Array(10).fill("Upside"),
      ...Array(10).fill("Downside"),
    ]);
    // Values are written exactly as the API returned them (full precision, no rounding).
    expect(rows[1][RESULT_CSV_COLUMNS.indexOf("gross_revenue")]).toBe("38400000.000000");
    expect(Number(rows[1][RESULT_CSV_COLUMNS.indexOf("net_revenue")])).toBe(28_800_000);
  });

  it("is fully viewable by a Brand Lead", async () => {
    await renderDashboard("BRAND_LEAD");
    expect(kpi(/Net revenue · 2036/)).toBeInTheDocument();
  });
});
