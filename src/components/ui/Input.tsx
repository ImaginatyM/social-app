export default function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none
      focus:ring-2 focus:ring-brand-500/40 ${props.className||""}`}
    />
  );
}
