import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import { scenariosApi } from "../../api/scenarios";
import type { VersionComment, VersionDetail, VersionSummary } from "../../api/types";
import { versionsApi } from "../../api/versions";
import { parseCsv } from "../../lib/csv";
import { downloadCsv } from "../../lib/download";
import { BASE_YEARS, forecast, STANDARD_SCENARIOS } from "../../test/fixtures";
import { renderAsUser, TEST_USERS } from "../../test/render";
import { VersionsPage } from "./VersionsPage";

vi.mock("../../api/scenarios", () => ({ scenariosApi: { list: vi.fn() } }));
vi.mock("../../api/versions", () => ({
  versionsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), comments: vi.fn(), addComment: vi.fn() },
}));
vi.mock("../../lib/download", () => ({ downloadCsv: vi.fn() }));

const api = vi.mocked(versionsApi);
const FORECASTER = { id: 1, email: "forecaster@example.com", role: "FORECASTER" as const };
const BRAND_LEAD = { id: 2, email: "brandlead@example.com", role: "BRAND_LEAD" as const };

function summary(id: number, comment: string | null, createdAt: string): VersionSummary {
  return { id, created_by: 1, author: FORECASTER, created_at: createdAt, comment };
}

function detail(version: VersionSummary): VersionDetail {
  const upsideYears = BASE_YEARS.map((y) => ({ ...y, peak_brand_share_pct: "25" }));
  return {
    ...version,
    snapshot: {
      scenarios: [
        { scenario_id: 1, name: "Base", description: "Base case assumptions", years: BASE_YEARS, forecast: forecast(1).years },
        { scenario_id: 2, name: "Upside", description: "Illustrative upside", years: upsideYears, forecast: forecast(2, 1.25).years },
      ],
    },
  };
}

const V1 = summary(1, "Initial baseline", "2026-11-10T09:00:00Z");
const V2 = summary(2, "After uptake review", "2026-11-12T15:30:00Z");
const EXISTING_COMMENT: VersionComment = {
  id: 10,
  version_id: 2,
  user_id: 2,
  author: BRAND_LEAD,
  content: "Upside uptake looks aggressive.",
  created_at: "2026-11-13T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(scenariosApi.list).mockResolvedValue(STANDARD_SCENARIOS);
  api.list.mockResolvedValue([V2, V1]);
  api.get.mockImplementation(async (id) => detail(id === 2 ? V2 : V1));
  api.comments.mockImplementation(async (id) => (id === 2 ? [EXISTING_COMMENT] : []));
});

function renderVersions(role: "FORECASTER" | "BRAND_LEAD" = "FORECASTER", initialEntry = "/versions") {
  return renderAsUser(<VersionsPage />, role, { paths: ["/versions", "/versions/:versionId"], initialEntry });
}

describe("VersionsPage – history", () => {
  it("lists versions newest first with author, time and comment, and opens the newest", async () => {
    const { router } = renderVersions();

    expect(await screen.findByRole("heading", { name: "Version #2" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/versions/2");

    const list = screen.getByRole("navigation", { name: "Saved versions" });
    const items = within(list).getAllByRole("button");
    expect(items.map((b) => b.querySelector(".version-list__comment")?.textContent)).toEqual([
      "After uptake review",
      "Initial baseline",
    ]);
    expect(items[0]).toHaveTextContent("forecaster@example.com · Forecaster");
    expect(items[0]).toHaveAttribute("aria-current", "true");
  });

  it("shows the saved snapshot read-only with its author and comment", async () => {
    renderVersions();
    await screen.findByRole("heading", { name: "Version #2" });

    expect(screen.getByText("Read-only snapshot")).toBeInTheDocument();
    expect(screen.getByText("After uptake review", { selector: "blockquote" })).toBeInTheDocument();
    expect(screen.getByText(/Saved by/)).toHaveTextContent("Saved by forecaster@example.com (Forecaster)");

    const inputs = screen.getByRole("heading", { name: "Saved inputs" }).closest("section")!;
    expect(within(inputs).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(inputs).getAllByText("20%").length).toBeGreaterThan(0);
  });

  it("switches between snapshot scenarios", async () => {
    renderVersions();
    await screen.findByRole("heading", { name: "Version #2" });

    const inputs = screen.getByRole("heading", { name: "Saved inputs" }).closest("section")!;
    await userEvent.click(within(inputs).getByRole("button", { name: "Upside" }));

    const peakShareRow = within(inputs).getByRole("rowheader", { name: /Peak brand share/ }).closest("tr")!;
    expect(within(peakShareRow).getAllByRole("cell").map((c) => c.textContent)).toEqual(Array(10).fill("25%"));
    expect(screen.getByRole("heading", { name: "Patient funnel" }).closest("section")).toHaveTextContent("Upside · 2036");
  });

  it("opens an older version", async () => {
    const { router } = renderVersions();
    await screen.findByRole("heading", { name: "Version #2" });

    await userEvent.click(screen.getByRole("button", { name: /Initial baseline/ }));

    expect(await screen.findByRole("heading", { name: "Version #1" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/versions/1");
    expect(api.get).toHaveBeenLastCalledWith(1);
  });

  it("exports the snapshot's results", async () => {
    renderVersions("BRAND_LEAD");
    await screen.findByRole("heading", { name: "Version #2" });

    await userEvent.click(screen.getByRole("button", { name: "Export results CSV" }));

    const [filename, csv] = vi.mocked(downloadCsv).mock.calls[0];
    expect(filename).toBe("launchlens-version-2-results.csv");
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1 + 2 * 10);
    expect(rows[1].slice(0, 2)).toEqual(["Base", "2027"]);
    expect(rows[11].slice(0, 2)).toEqual(["Upside", "2027"]);
  });

  it("shows an empty state when nothing has been saved", async () => {
    api.list.mockResolvedValue([]);
    renderVersions("BRAND_LEAD");

    expect(await screen.findByRole("heading", { name: "No versions saved yet" })).toBeInTheDocument();
    expect(screen.getByText("A Forecaster hasn't saved a forecast version yet.")).toBeInTheDocument();
  });
});

describe("VersionsPage – saving", () => {
  it("lets a Forecaster save a version with a required comment", async () => {
    const V3 = summary(3, "Q4 refresh", "2026-11-14T08:00:00Z");
    api.create.mockResolvedValue(detail(V3));
    const { router } = renderVersions();
    await screen.findByRole("heading", { name: "Version #2" });

    await userEvent.click(screen.getByRole("button", { name: "Save version" }));
    const dialog = screen.getByRole("dialog", { name: "Save forecast version" });
    expect(dialog).toHaveTextContent("Saves a read-only snapshot of all 3 scenarios");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save version" }));
    expect(within(dialog).getByText("Describe what this version captures")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();

    api.list.mockResolvedValue([V3, V2, V1]);
    api.get.mockResolvedValue(detail(V3));
    await userEvent.type(within(dialog).getByLabelText("Comment"), "  Q4 refresh  ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save version" }));

    expect(api.create).toHaveBeenCalledWith({ comment: "Q4 refresh" });
    expect(await screen.findByRole("heading", { name: "Version #3" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/versions/3");
  });

  it("does not offer saving to a Brand Lead", async () => {
    renderVersions("BRAND_LEAD");
    await screen.findByRole("heading", { name: "Version #2" });

    expect(screen.queryByRole("button", { name: "Save version" })).not.toBeInTheDocument();
  });

  it("shows the API error if saving is refused", async () => {
    api.create.mockRejectedValue(new ApiError(403, "You don't have permission to do this. Only Forecasters can perform this action."));
    renderVersions();
    await screen.findByRole("heading", { name: "Version #2" });

    await userEvent.click(screen.getByRole("button", { name: "Save version" }));
    const dialog = screen.getByRole("dialog", { name: "Save forecast version" });
    await userEvent.type(within(dialog).getByLabelText("Comment"), "try");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save version" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("You don't have permission");
  });
});

describe("VersionsPage – comments", () => {
  it("shows existing comments with author email and role", async () => {
    renderVersions();
    const comments = await screen.findByRole("region", { name: /Comments/ });

    const items = await within(comments).findAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("brandlead@example.com");
    expect(items[0]).toHaveTextContent("Brand Lead");
    expect(items[0]).toHaveTextContent("Upside uptake looks aggressive.");
  });

  it("lets a Brand Lead add a comment", async () => {
    api.addComment.mockImplementation(async (versionId, content) => ({
      id: 11,
      version_id: versionId,
      user_id: TEST_USERS.BRAND_LEAD.id,
      author: BRAND_LEAD,
      content,
      created_at: "2026-11-14T09:00:00Z",
    }));
    renderVersions("BRAND_LEAD");
    const comments = await screen.findByRole("region", { name: /Comments/ });
    await within(comments).findAllByRole("listitem");

    await userEvent.type(within(comments).getByLabelText("Add a comment"), "  Agree with the downside view.  ");
    await userEvent.click(within(comments).getByRole("button", { name: "Post comment" }));

    expect(api.addComment).toHaveBeenCalledWith(2, "Agree with the downside view.");
    await waitFor(() => expect(within(comments).getAllByRole("listitem")).toHaveLength(2));
    const added = within(comments).getAllByRole("listitem")[1];
    expect(added).toHaveTextContent("brandlead@example.com (you)");
    expect(within(comments).getByLabelText("Add a comment")).toHaveValue("");
  });

  it("does not post an empty comment", async () => {
    renderVersions("BRAND_LEAD");
    const comments = await screen.findByRole("region", { name: /Comments/ });

    await userEvent.click(within(comments).getByRole("button", { name: "Post comment" }));

    expect(within(comments).getByText("Write a comment first.")).toBeInTheDocument();
    expect(api.addComment).not.toHaveBeenCalled();
  });
});
