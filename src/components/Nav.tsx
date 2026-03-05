"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

interface NavProps {
  user: { name?: string | null; email: string; role: string };
  tenant: { name: string };
}

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transfers", label: "Transfers" },
  { href: "/discounts", label: "Discounts" },
  { href: "/cogs", label: "COGS" },
  { href: "/settings", label: "Settings" },
];

export default function Nav({ user, tenant }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-14">
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="font-bold text-lg text-emerald-700">
              {tenant.name || "Adagio Replenishment"}
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium ${
                  pathname === item.href
                    ? "text-emerald-700 border-b-2 border-emerald-700"
                    : "text-gray-600 hover:text-gray-900"
                } py-4`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="text-gray-500 hover:text-gray-700 relative"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <span className="text-sm text-gray-600">{user.name || user.email}</span>
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">{user.role}</span>
            <button onClick={handleLogout} className="text-sm text-red-600 hover:text-red-800">
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
