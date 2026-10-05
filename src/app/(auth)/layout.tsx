import { connection } from "next/server";
import { getServerBranding } from "@/lib/branding/server";
import { logoBackgroundColor } from "@/lib/branding/brand-name";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Logo and name follow Admin → Branding, read per request.
  await connection();
  const brand = await getServerBranding();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-4 py-10">
      {brand.logoUrl ? (
        // Same dark panel as the sidebar the logo was chosen for: a
        // "transparent" logo is usually light-on-dark and would vanish on white.
        <div className="rounded-xl bg-slate-950 px-6 py-5 shadow-sm">
          <div
            className="rounded-lg p-2"
            style={{
              backgroundColor: logoBackgroundColor(
                brand.logoBackground,
                brand.logoBackgroundColor,
              ),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-supplied URL, any host */}
            <img
              src={brand.logoUrl}
              alt={brand.logoAlt}
              className="mx-auto h-14 w-auto object-contain"
            />
          </div>
        </div>
      ) : (
        <div className="text-2xl font-bold text-slate-900">{brand.name}</div>
      )}
      {children}
    </div>
  );
}
