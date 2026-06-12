export default function ChatPage() {
  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Orgonite Tunisie</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <p className="text-muted-foreground text-center mt-8">Bienvenue ! Commencez une conversation.</p>
      </main>
      <footer className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Écrivez votre message..."
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Envoyer
          </button>
        </div>
      </footer>
    </div>
  );
}
