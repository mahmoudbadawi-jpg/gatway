export function ModuleCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="card p-5 transition hover:border-teal">
      <h3 className="mb-1.5 font-semibold text-navy">{title}</h3>
      <p className="text-sm text-navy/60">{description}</p>
    </div>
  );
}
