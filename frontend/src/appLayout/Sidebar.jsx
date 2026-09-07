function Sidebar() {
  return (
    <aside className="w-64 shrink-0 border-r bg-background">
      <div className="flex h-full min-h-screen flex-col p-4">
        <h1 className="text-xl font-semibold">SkillForge</h1>

        <nav className="mt-8 space-y-2">
          <div className="rounded-md px-3 py-2 text-sm">Dashboard</div>

          <div className="rounded-md px-3 py-2 text-sm">Learning Materials</div>

          <div className="rounded-md px-3 py-2 text-sm">Practice</div>

          <div className="rounded-md px-3 py-2 text-sm">Progress</div>
        </nav>
      </div>
    </aside>
  );
}

export default Sidebar;
