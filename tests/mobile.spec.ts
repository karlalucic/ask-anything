import { expect, test } from "@playwright/test";

const draft = {
  v: 2,
  updatedAt: new Date().toISOString(),
  step: "style",
  topic: "Xenobots and the information plane",
  duration: 20,
  familiarity: "intermediate",
  intent: "curious",
  styleInput: "Mel Robbins",
  sourcesConfig: {
    web: true,
    academic: false,
    userDocs: false,
    recency: "any",
    domains: [],
    userDocIds: [],
  },
  voice: "ara",
};

test("landing page renders a mobile-safe hero fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();
  await expect(page.getByTestId("hero-backdrop")).toBeVisible();
  await expect(page.getByTestId("hero-video")).toHaveCount(0);
});

test("wizard keeps the primary action visible on mobile", async ({ page }) => {
  await page.goto("/new");

  await page.getByLabel("What do you want to learn about?").fill("How xenobots work");
  const continueButton = page.getByRole("button", { name: "Continue" }).last();
  await expect(continueButton).toBeVisible();

  const box = await continueButton.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});

test("wizard restores a versioned draft after reload", async ({ page }) => {
  await page.goto("/new");

  const topic = page.getByLabel("What do you want to learn about?");
  await topic.fill("Why sleep matters for memory");
  await page.reload();

  await expect(page.getByLabel("What do you want to learn about?")).toHaveValue("Why sleep matters for memory");
});

test("style analysis does not run from input blur", async ({ page }) => {
  let styleRequests = 0;
  await page.route("**/api/style/card", async (route) => {
    styleRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        styleCard: {
          openingPattern: "Start with a practical promise.",
          chapterShape: "Short, concrete sections.",
          sentenceRhythm: "Direct and conversational.",
          signatureMoves: ["plain language"],
          targetWordCountRange: [1000, 1400],
        },
        followups: [],
      }),
    });
  });

  await page.addInitScript((draftPayload) => {
    window.localStorage.setItem("aa:draft:v2", JSON.stringify({
      ...(draftPayload as typeof draft),
      updatedAt: new Date().toISOString(),
    }));
  }, draft);

  await page.goto("/new");
  const styleInput = page.getByLabel("Writing style");
  await expect(styleInput).toBeVisible();

  await styleInput.focus();
  await styleInput.blur();
  expect(styleRequests).toBe(0);

  await page.waitForTimeout(250);
  expect(styleRequests).toBe(0);
});
