import { test, expect } from "@playwright/test";

test.describe("ESATIC SmartVote — Tests End-to-End", () => {
  test("La page d'accueil s'affiche correctement avec le titre et les boutons d'action", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ESATIC SmartVote/);
    await expect(page.locator("h1")).toContainText("Plateforme de Vote");
  });

  test("Navigation vers la page de connexion étudiant", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("Connexion étudiant");
    await expect(page.locator("input[placeholder*='22-ESATIC']")).toBeVisible();
  });

  test("Navigation vers la page d'activation de compte", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("h1")).toContainText("Créer mon compte");
    await expect(page.locator("button:has-text('Obtenir le code')")).toBeVisible();
  });

  test("La jauge de mot de passe réagit à la saisie", async ({ page }) => {
    await page.goto("/register");
    const passwordInput = page.locator("input[placeholder*='Au moins 8 caractères']");
    await passwordInput.fill("12345");
    await expect(page.locator("text=Trop court")).toBeVisible();

    await passwordInput.fill("SuperSecret123!");
    await expect(page.locator("text=Fort")).toBeVisible();
  });
});
