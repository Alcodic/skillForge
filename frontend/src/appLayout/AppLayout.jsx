import { useState } from "react";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MainContent from "./MainContent";

function AppLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />

        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}

export default AppLayout;
