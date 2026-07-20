import GenieChatWidget from "../_components/GenieChatWidget";

// URL: /embed?account=Acme%20Corp&owner=Jane%20Smith
// Designed to be iframed from Salesforce (or any host). Fills 100% of the frame.
export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; owner?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="sf-embed-root">
      <GenieChatWidget
        mode="fill"
        account={params.account ?? "Acme Corp"}
        owner={params.owner ?? "Jane Smith"}
      />
    </div>
  );
}
