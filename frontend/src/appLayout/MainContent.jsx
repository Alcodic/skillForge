function MainContent({ children }) {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-background">
      {children}
    </main>
  );
}

export default MainContent;
