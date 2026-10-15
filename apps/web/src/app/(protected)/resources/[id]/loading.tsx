export default function ResourceLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 animate-pulse">
      <div className="h-3 w-20 rounded bg-line/80" />
      <div className="mt-4 h-9 w-full max-w-xl rounded bg-line/70" />
      <div className="mt-4 space-y-2">
        <div className="h-4 w-full rounded bg-line/50" />
        <div className="h-4 w-full rounded bg-line/50" />
        <div className="h-4 w-5/6 rounded bg-line/50" />
      </div>
      <div className="mt-6 h-10 w-40 rounded bg-line/60" />
      <div className="mt-8 aspect-[16/10] w-full rounded-md bg-line/40" />
    </div>
  );
}
