import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { scenariosApi } from "../../api/scenarios";
import { forecast, STANDARD_SCENARIOS } from "../../test/fixtures";
import { renderAsUser } from "../../test/render";
import { DashboardPage } from "./DashboardPage";

vi.mock("../../api/scenarios", () => ({
  scenariosApi: { list: vi.fn(), forecast: vi.fn() },
}));

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

  it("is fully viewable by a Brand Lead", async () => {
    await renderDashboard("BRAND_LEAD");
    expect(kpi(/Net revenue · 2036/)).toBeInTheDocument();
  });
});
