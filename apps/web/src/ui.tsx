import type { ComponentProps, ReactNode } from "react";

export const buttonClass =
  "bg-gold text-ink hover:bg-gold-dark rounded-md px-4 py-2 font-semibold transition-colors disabled:opacity-50";

export const inputClass =
  "border-muted focus:border-gold-dark focus:ring-gold mt-1 block w-full rounded-md border bg-white px-3 py-2 focus:ring-2 focus:outline-none";

export function Field({ label, ...props }: { label: string } & ComponentProps<"input">) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <input {...props} className={inputClass} />
    </label>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-md p-6 pt-16">
      <h1 className="mb-6 text-3xl font-bold">{title}</h1>
      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">{children}</div>
    </main>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-sm font-semibold text-red-700">
      {message}
    </p>
  ) : null;
}
