import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import { scenariosApi } from "../../api/scenarios";
import type { ScenarioUpdate } from "../../api/types";
import { BASE_YEARS, detail, STANDARD_SCENARIOS, summary } from "../../test/fixtures";
import { renderAsUser } from "../../test/render";
import { ScenariosPage } from "./ScenariosPage";

vi.mock("../../api/scenarios", () => ({
  scenariosApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    clone: vi.fn(),
    forecast: vi.fn(),
  },
}));

const api = vi.mocked(scenariosApi);
const CUSTOM = summary(4, "High price", "Price sensitivity");

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue([CUSTOM, ...STANDARD_SCENARIOS]);
  api.get.mockImplementation(async (id) => detail([...STANDARD_SCENARIOS, CUSTOM].find((s) => s.id === id)!));
});

async function renderPage(role: "FORECASTER" | "BRAND_LEAD" = "FORECASTER") {
  const view = renderAsUser(<ScenariosPage />, role);
  await screen.findByRole("table");
  return view;
}

const cell = (field: string, year: number) => screen.getByRole("textbox", { name: `${field}, ${year}` });

describe("ScenariosPage – list", () => {
  it("separates standard and custom scenarios and opens Base by default", async () => {
    await renderPage();

    const list = screen.getByRole("navigation", { name: "Scenarios" });
    const buttons = within(list).getAllByRole("button");
    expect(buttons.map((b) => b.querySelector(".scenario-list__name")?.textContent)).toEqual([
      "Base",
      "Upside",
      "Downside",
      "High price",
    ]);
    expect(within(list).getByText("Standard scenarios")).toBeInTheDocument();
    expect(within(list).getByText("Custom scenarios")).toBeInTheDocument();
    expect(within(buttons[3]).getByText("Custom")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Base" })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(1);
  });

  it("switches the active scenario", async () => {
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: /High price/ }));

    expect(await screen.findByRole("heading", { level: 2, name: "High price" })).toBeInTheDocument();
    expect(api.get).toHaveBeenLastCalledWith(4);
  });
});

describe("ScenariosPage – input grid", () => {
  it("shows all nine inputs for all ten years in readable formats", async () => {
    await renderPage();

    expect(screen.getAllByRole("textbox")).toHaveLength(90);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Assumption",
      ...BASE_YEARS.map((y) => String(y.year)),
    ]);
    expect(cell("Prevalent patients", 2027)).toHaveValue("2,000,000");
    expect(cell("Diagnosed", 2027)).toHaveValue("60%");
    expect(cell("Uptake", 2029)).toHaveValue("55%");
    expect(cell("Annual gross price", 2027)).toHaveValue("$10,000");
    // Rounded for display, exact value available on hover.
    expect(cell("Prevalent patients", 2036)).toHaveValue("2,187,371");
    expect(cell("Prevalent patients", 2036)).toHaveAttribute("title", "Exact value: 2187370.545368721802000000");
  });

  it("shows the exact value while editing", async () => {
    await renderPage();
    await userEvent.click(cell("Prevalent patients", 2036));
    expect(cell("Prevalent patients", 2036)).toHaveValue("2187370.545368721802000000");
  });

  it("saves edited values exactly and sends untouched values unchanged", async () => {
    api.update.mockImplementation(async (id, body: ScenarioUpdate) => ({ ...detail(STANDARD_SCENARIOS[0]), id, years: body.years }));
    await renderPage();

    await userEvent.clear(cell("Uptake", 2027));
    await userEvent.type(cell("Uptake", 2027), "12.345678");
    await userEvent.clear(cell("Annual gross price", 2030));
    await userEvent.type(cell("Annual gross price", 2030), "10,500.25");
    expect(screen.getByText("2 unsaved changes")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.update).toHaveBeenCalledOnce());
    const [id, body] = api.update.mock.calls[0];
    expect(id).toBe(1);
    expect(body.name).toBe("Base");
    expect(body.years[0].uptake_pct).toBe("12.345678");
    expect(body.years[3].annual_price).toBe("10500.25");
    // Every other value is byte-for-byte what the API sent, including full precision.
    const untouched = body.years.map((y, i) =>
      i === 0 ? { ...y, uptake_pct: BASE_YEARS[0].uptake_pct } : i === 3 ? { ...y, annual_price: BASE_YEARS[3].annual_price } : y,
    );
    expect(untouched).toEqual(BASE_YEARS);
    expect(await screen.findByText("All changes saved")).toBeInTheDocument();
  });

  it("blocks saving and explains invalid values", async () => {
    await renderPage();

    await userEvent.clear(cell("Compliance", 2028));
    await userEvent.type(cell("Compliance", 2028), "120");
    await userEvent.clear(cell("Annual gross price", 2031));
    await userEvent.type(cell("Annual gross price", 2031), "-5");

    expect(cell("Compliance", 2028)).toHaveAttribute("aria-invalid", "true");
    expect(cell("Compliance", 2028)).toHaveAttribute("title", "Must be between 0% and 100%");
    const list = screen.getByText("Fix these values before saving:").parentElement!;
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Compliance, 2028 — Must be between 0% and 100%",
      "Annual gross price, 2031 — Cannot be negative",
    ]);
    expect(screen.getByText("2 values need attention")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("shows server validation errors on the affected cells", async () => {
    api.update.mockRejectedValue(
      new ApiError(422, "Some values are invalid. Review the highlighted fields.", [
        { loc: ["body", "years", 1, "eligible_pct"], msg: "Input should be less than or equal to 100", type: "less_than_equal" },
      ]),
    );
    await renderPage();

    await userEvent.clear(cell("Eligible for drug class", 2028));
    await userEvent.type(cell("Eligible for drug class", 2028), "41");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/Input should be less than or equal to 100/)).toHaveTextContent(
      "Eligible for drug class, 2028 — Input should be less than or equal to 100",
    );
    expect(cell("Eligible for drug class", 2028)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Changes not saved");
  });

  it("discards unsaved edits", async () => {
    await renderPage();
    await userEvent.clear(cell("Diagnosed", 2027));
    await userEvent.type(cell("Diagnosed", 2027), "70");
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(cell("Diagnosed", 2027)).toHaveValue("60%");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("asks before switching scenarios with unsaved edits", async () => {
    await renderPage();
    await userEvent.clear(cell("Diagnosed", 2027));
    await userEvent.type(cell("Diagnosed", 2027), "70");

    await userEvent.click(screen.getByRole("button", { name: /Upside/ }));
    const dialog = await screen.findByRole("dialog", { name: "Discard unsaved changes?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(cell("Diagnosed", 2027)).toHaveValue("70%");

    await userEvent.click(screen.getByRole("button", { name: /Upside/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard and switch" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Upside" })).toBeInTheDocument();
  });
});

describe("ScenariosPage – scenario actions", () => {
  it("creates a scenario from the Base assumptions and selects it", async () => {
    const created = summary(5, "Payer pushback");
    api.create.mockResolvedValue(detail(created));
    await renderPage();
    api.list.mockResolvedValue([...STANDARD_SCENARIOS, CUSTOM, created]);
    api.get.mockResolvedValue(detail(created));

    await userEvent.click(screen.getByRole("button", { name: "New scenario" }));
    const dialog = screen.getByRole("dialog", { name: "New scenario" });
    await userEvent.type(within(dialog).getByLabelText("Name"), "  Payer pushback ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create scenario" }));

    expect(api.create).toHaveBeenCalledWith({ name: "Payer pushback", description: null });
    expect(await screen.findByRole("heading", { level: 2, name: "Payer pushback" })).toBeInTheDocument();
  });

  it("requires a name before creating", async () => {
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "New scenario" }));
    await userEvent.click(screen.getByRole("button", { name: "Create scenario" }));

    expect(screen.getByText("Enter a scenario name")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("clones the active scenario", async () => {
    const clone = summary(6, "Base (copy)");
    api.clone.mockResolvedValue(detail(clone));
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Clone" }));
    const dialog = screen.getByRole("dialog", { name: "Clone scenario" });
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Base (copy)");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create copy" }));

    expect(api.clone).toHaveBeenCalledWith(1, { name: "Base (copy)" });
  });

  it("renames using the saved inputs, not unsaved grid edits", async () => {
    api.update.mockImplementation(async (id, body) => ({ ...detail(STANDARD_SCENARIOS[0]), id, ...body }));
    await renderPage();
    await userEvent.clear(cell("Diagnosed", 2027));
    await userEvent.type(cell("Diagnosed", 2027), "70");

    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    const dialog = screen.getByRole("dialog", { name: "Edit scenario details" });
    await userEvent.clear(within(dialog).getByLabelText("Name"));
    await userEvent.type(within(dialog).getByLabelText("Name"), "Base 2026");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save details" }));

    await waitFor(() => expect(api.update).toHaveBeenCalledOnce());
    const body = api.update.mock.calls[0][1];
    expect(body.name).toBe("Base 2026");
    expect(body.description).toBe("Base case assumptions");
    expect(body.years).toEqual(BASE_YEARS);
    // The grid edit is still pending.
    expect(cell("Diagnosed", 2027)).toHaveValue("70%");
  });

  it("deletes a scenario only after confirmation", async () => {
    api.remove.mockResolvedValue(undefined);
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: /High price/ }));
    await screen.findByRole("heading", { level: 2, name: "High price" });

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete scenario?" });
    expect(dialog).toHaveTextContent("High price and all ten years of its inputs will be permanently deleted.");
    expect(api.remove).not.toHaveBeenCalled();

    api.list.mockResolvedValue(STANDARD_SCENARIOS);
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete scenario" }));

    expect(api.remove).toHaveBeenCalledWith(4);
    expect(await screen.findByRole("heading", { level: 2, name: "Base" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /High price/ })).not.toBeInTheDocument();
  });

  it("shows a permission error if the backend refuses an action", async () => {
    api.remove.mockRejectedValue(new ApiError(403, "You don't have permission to do this. Only Forecasters can perform this action."));
    await renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete scenario" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You don't have permission");
  });
});

describe("ScenariosPage – Brand Lead", () => {
  it("is read-only: no inputs, no create, rename, clone, delete or save", async () => {
    await renderPage("BRAND_LEAD");

    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByText("2,000,000")).toBeInTheDocument();
    expect(screen.getByText(/view-only access/)).toBeInTheDocument();
    for (const name of ["New scenario", "Rename", "Clone", "Delete", "Save changes", "Discard"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("can still browse every scenario", async () => {
    await renderPage("BRAND_LEAD");
    await userEvent.click(screen.getByRole("button", { name: /Downside/ }));
    expect(await screen.findByRole("heading", { level: 2, name: "Downside" })).toBeInTheDocument();
  });
});
