import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("pages/LandingPage.tsx"),

  // Public routes
  route("login", "pages/LoginPage.tsx"),
  route("register", "pages/RegisterAccountPage.tsx"),
  route("register-item", "pages/RegisterItemPage.tsx"),
  route("lookup", "pages/LookupPage.tsx"),
  route("lookup/photo", "pages/LookupPhotoPage.tsx"),
  route("c/:code", "pages/CodeScanPage.tsx"),
  route("registry", "pages/PartnerPage.tsx"),
  route("privacy", "pages/PrivacyPolicyPage.tsx"),
  route("terms", "pages/TermsOfServicePage.tsx"),
  route("data-deletion", "pages/DataDeletionPage.tsx"),
  route("faq", "pages/FaqPage.tsx"),
  route("contact", "pages/ContactPage.tsx"),
  route("about", "pages/AboutPage.tsx"),
  route("shop", "pages/BoutiquePage.tsx"),
  route("shop/success", "pages/BoutiqueSuccessPage.tsx"),
  route("verify-email", "pages/VerifyEmailPage.tsx"),
  route("email-pending", "pages/EmailPendingPage.tsx"),
  route("auth/google/callback", "pages/OAuthCallbackPage.tsx", { id: "auth-google" }),
  route("auth/facebook/callback", "pages/OAuthCallbackPage.tsx", { id: "auth-facebook" }),
  route("auth/microsoft/callback", "pages/OAuthCallbackPage.tsx", { id: "auth-microsoft" }),

  // Protected routes (require auth)
  layout("layouts/protected.tsx", [
    route("dashboard", "pages/DashboardPage.tsx"),
    route("profile", "pages/ProfilePage.tsx"),
    route("settings", "pages/SettingsPage.tsx"),
    route("items/:id", "pages/ItemDetailPage.tsx"),
    route("edit/:id", "pages/EditItemPage.tsx"),
    route("report-theft", "pages/ReportTheftPage.tsx"),
  ]),

  // Admin routes (require admin)
  layout("layouts/admin.tsx", [
    route("admin", "pages/AdminDashboardPage.tsx"),
    route("admin/items", "pages/AdminItemsPage.tsx"),
    route("admin/clients", "pages/AdminClientsPage.tsx"),
    route("admin/orders", "pages/AdminOrdersPage.tsx"),
    route("admin/orders/:id", "pages/AdminOrderDetailPage.tsx"),
    route("admin/products", "pages/AdminProductsPage.tsx"),
    route("admin/products/:id", "pages/AdminProductEditPage.tsx"),
  ]),

  route("*", "pages/NotFoundPage.tsx"),
] satisfies RouteConfig;
