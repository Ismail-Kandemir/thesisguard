const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

function main() {
  const indexHtml = read("index.html");
  const router = read("src/app/router/router.tsx");
  const routeErrorPage = read("src/pages/RouteErrorPage.tsx");
  const loginPage = read("src/pages/LoginPage.tsx");
  const registerPage = read("src/pages/RegisterPage.tsx");
  const forgotPasswordPage = read("src/pages/ForgotPasswordPage.tsx");

  assertIncludes(indexHtml, '<html lang="tr">', "Turkish document language");
  assertIncludes(indexHtml, "<title>ThesisGuard</title>", "release document title");
  assertIncludes(indexHtml, 'name="description"', "release description metadata");
  assertIncludes(indexHtml, 'src="/src/main.tsx"', "real TypeScript entrypoint");
  assertNotIncludes(indexHtml, "main.jsx", "stale JavaScript entrypoint");
  assertNotIncludes(indexHtml, "tez-sorgu", "old placeholder title");

  assertNoSensitiveConsole(loginPage, "login page");
  assertNoSensitiveConsole(registerPage, "register page");
  assertNoSensitiveConsole(forgotPasswordPage, "forgot password page");
  assertIncludes(loginPage, "Giriş özelliği bu sürümde henüz aktif değildir.", "login safe placeholder message");
  assertIncludes(registerPage, "Kayıt özelliği bu sürümde henüz aktif değildir.", "register safe placeholder message");
  assertIncludes(forgotPasswordPage, "Şifre sıfırlama özelliği bu sürümde henüz aktif değildir.", "forgot password safe placeholder message");

  assertIncludes(router, "createBrowserRouter", "browser router remains in use");
  assertIncludes(router, "errorElement: <RouteErrorPage />", "route-level runtime error fallback");
  assertIncludes(routeErrorPage, "Tez Yükleme Ekranına Dön", "fallback recovery action");
  assertIncludes(routeErrorPage, "routePaths.upload", "fallback returns to upload route");

  assert(!exists("public/_redirects"), "provider-specific Netlify redirects were not added without a provider");
  assert(!exists("vercel.json"), "provider-specific Vercel config was not added without a provider");

  console.log("Release deployment hardening regression passed.");
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function assertNoSensitiveConsole(source, label) {
  assertNotIncludes(source, "console.", `${label} does not write user data to console`);
}

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`${label}: expected ${expected}`);
  }
}

function assertNotIncludes(source, unexpected, label) {
  if (source.includes(unexpected)) {
    throw new Error(`${label}: unexpected ${unexpected}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main();
