function Topbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div>
        <h2 className="text-lg font-semibold">SkillForge</h2>
      </div>

      <div className="text-sm text-muted-foreground">Welcome back</div>
    </header>
  );
}

export default Topbar;
