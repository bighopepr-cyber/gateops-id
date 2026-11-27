import { expect, test } from "@playwright/test";

test("login page presents username and password fields", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Masuk ke GATEOPS" })).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("unauthenticated dashboard redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("unauthenticated users cannot access password change", async ({ page }) => {
  await page.goto("/change-password");
  await expect(page).toHaveURL(/\/login$/);
});

test("login succeeds for all four roles", async ({ page }) => {
  const accounts = [
    ["ci-admin", process.env.SEED_SUPER_ADMIN_PASSWORD!, "/dashboard"],
    ["ci-komandan", process.env.SEED_KOMANDAN_PASSWORD!, "/dashboard"],
    ["ci-personel", process.env.SEED_PERSONEL_PASSWORD!, "/dashboard"],
    ["ci-persit", process.env.SEED_PERSIT_PASSWORD!, "/dashboard"],
  ];
  for (const [username, password, expectedUrl] of accounts) {
    await page.goto("/login");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    const responsePromise = page.waitForResponse((r) => r.url().includes("/api/auth/login") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Masuk" }).click();
    const response = await responsePromise;
    expect(response.ok(), `Login ${username} gagal`).toBe(true);
    await expect(page).toHaveURL((url) => url.pathname === expectedUrl);
  }
});

test("login rejected with wrong password", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("ci-admin");
  await page.getByLabel("Password").fill("wrong-password-12345");
  const responsePromise = page.waitForResponse((r) => r.url().includes("/api/auth/login") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Masuk" }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(false);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("alert")).toBeVisible();
});

test("login rejected with unknown username", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("tidak-terdaftar");
  await page.getByLabel("Password").fill("password12345");
  const responsePromise = page.waitForResponse((r) => r.url().includes("/api/auth/login") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Masuk" }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(false);
  await expect(page).toHaveURL(/\/login$/);
});

test("each role can change own password", async ({ page }) => {
  const accounts = [
    ["ci-admin", process.env.SEED_SUPER_ADMIN_PASSWORD!],
    ["ci-komandan", process.env.SEED_KOMANDAN_PASSWORD!],
    ["ci-personel", process.env.SEED_PERSONEL_PASSWORD!],
    ["ci-persit", process.env.SEED_PERSIT_PASSWORD!],
  ];
  const newPassword = "ChangedPassword12345!";
  for (const [username, oldPassword] of accounts) {
    await page.goto("/login");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(oldPassword);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/dashboard");

    await page.getByRole("link", { name: /Ubah password/ }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/change-password");

    await page.getByLabel("Password saat ini").fill(oldPassword);
    await page.getByLabel("Password baru").fill(newPassword);
    await page.getByLabel("Konfirmasi password baru").fill(newPassword);
    const responsePromise = page.waitForResponse((r) => r.url().includes("/api/auth/change-password") && r.request().method() === "POST");
    await page.getByRole("button", { name: /Simpan|Berhasil/ }).click();
    const response = await responsePromise;
    expect(response.ok(), `Ganti password ${username} gagal`).toBe(true);
    await expect(page.getByRole("status")).toContainText("Password berhasil diperbarui.");

    // Log in again with new password to confirm it works
    await page.getByRole("button", { name: /Keluar/ }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/dashboard");

    // Restore original password for other tests
    await page.getByRole("link", { name: /Ubah password/ }).click();
    await page.getByLabel("Password saat ini").fill(newPassword);
    await page.getByLabel("Password baru").fill(oldPassword);
    await page.getByLabel("Konfirmasi password baru").fill(oldPassword);
    await page.getByRole("button", { name: /Simpan|Berhasil/ }).click();
    await expect(page.getByRole("status")).toContainText("Password berhasil diperbarui.");
  }
});

test("logout ends session and redirects to login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("ci-admin");
  await page.getByLabel("Password").fill(process.env.SEED_SUPER_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/dashboard");

  await page.getByRole("button", { name: /Keluar/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Masuk ke GATEOPS" })).toBeVisible();

  // Session cookie should no longer grant access
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("Super Admin reset password forces target user to change password on next login", async ({ page }) => {
  const targetUsername = "ci-personel";
  const targetOldPassword = process.env.SEED_PERSONEL_PASSWORD!;
  const newPassword = "NewPassword12345!";

  await page.goto("/login");
  await page.getByLabel("Username").fill("ci-admin");
  await page.getByLabel("Password").fill(process.env.SEED_SUPER_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/dashboard");

  await page.getByRole("link", { name: /Pengelolaan Akun/ }).click();
  await expect(page.getByRole("heading", { name: "Pengelolaan Akun" })).toBeVisible();

  const targetRow = page.getByRole("row").filter({ hasText: targetUsername });
  await expect(targetRow).toBeVisible();
  await targetRow.getByRole("button", { name: /Reset password/ }).click();
  await expect(page.getByRole("heading", { name: /Reset password akun\?/ })).toBeVisible();
  await page.getByRole("button", { name: /Ya, reset password/ }).click();

  const temporaryPanel = page.getByRole("status").filter({ hasText: /Password sementara berhasil dibuat/ });
  await expect(temporaryPanel).toBeVisible();
  const displayedPassword = await temporaryPanel.locator("code").textContent();
  expect(displayedPassword).toBeTruthy();

  await page.getByRole("button", { name: /Tutup/ }).click();
  await page.getByRole("button", { name: /Keluar/ }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Target user logs in with temporary password
  await page.getByLabel("Username").fill(targetUsername);
  await page.getByLabel("Password").fill(displayedPassword!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/change-password");

  // Forced to change password (no "Password saat ini" field in forced mode)
  await page.getByLabel("Password baru").fill(newPassword);
  await page.getByLabel("Konfirmasi password baru").fill(newPassword);
  await page.getByRole("button", { name: /Simpan|Berhasil/ }).click();
  await expect(page.getByRole("status")).toContainText("Password berhasil diperbarui.");
  await expect(page).toHaveURL((url) => url.pathname === "/dashboard");

  // Verify new password works
  await page.getByRole("button", { name: /Keluar/ }).click();
  await page.goto("/login");
  await page.getByLabel("Username").fill(targetUsername);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/dashboard");

  // Restore original password
  await page.getByRole("link", { name: /Ubah password/ }).click();
  await page.getByLabel("Password saat ini").fill(newPassword);
  await page.getByLabel("Password baru").fill(targetOldPassword);
  await page.getByLabel("Konfirmasi password baru").fill(targetOldPassword);
  await page.getByRole("button", { name: /Simpan|Berhasil/ }).click();
  await expect(page.getByRole("status")).toContainText("Password berhasil diperbarui.");
});
