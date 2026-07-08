type PageHeaderProps = {
  title: string;
  description: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="px-6 py-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
          CRM SaaS
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>
    </header>
  );
}
