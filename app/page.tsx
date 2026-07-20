"use client";

import GenieChatWidget from "./_components/GenieChatWidget";

const FAKE_ACCOUNTS = [
  { name: "Acme Corp", type: "Customer - Direct", owner: "Jane Smith", industry: "Manufacturing" },
  { name: "Global Media Inc.", type: "Customer - Channel", owner: "David Lee", industry: "Media" },
  { name: "Northwind Traders", type: "Prospect", owner: "Priya Patel", industry: "Retail" },
  { name: "Contoso Ltd.", type: "Customer - Direct", owner: "Marcus Chen", industry: "Financial Services" },
  { name: "Fabrikam Robotics", type: "Prospect", owner: "Jane Smith", industry: "Technology" },
  { name: "Adventure Works", type: "Customer - Channel", owner: "Sofia Ramirez", industry: "Travel" },
];

export default function DemoPage() {
  return (
    <div className="sf-shell">
      <nav className="sf-topnav">
        <div className="sf-topnav-inner">
          <div className="sf-logo">salesforce</div>
          <div className="sf-app-switcher">Sales</div>
          <div className="sf-topnav-search">
            <span className="sf-search-icon">⌕</span>
            <span>Search Salesforce</span>
          </div>
          <div className="sf-topnav-icons">
            <span title="Setup">⚙</span>
            <span title="Help">?</span>
            <span title="Notifications">🔔</span>
            <span className="sf-avatar">JS</span>
          </div>
        </div>
        <div className="sf-tabbar">
          <div className="sf-tab">Home</div>
          <div className="sf-tab active">Accounts</div>
          <div className="sf-tab">Contacts</div>
          <div className="sf-tab">Opportunities</div>
          <div className="sf-tab">Leads</div>
          <div className="sf-tab">Reports</div>
          <div className="sf-tab">Dashboards</div>
        </div>
      </nav>

      <main className="sf-main">
        <div className="sf-listview">
          <div className="sf-listview-header">
            <div>
              <div className="sf-listview-eyebrow">Accounts</div>
              <div className="sf-listview-title">All Accounts</div>
            </div>
            <div className="sf-listview-actions">
              <button className="sf-btn">New</button>
              <button className="sf-btn">Import</button>
            </div>
          </div>
          <div className="sf-table">
            <div className="sf-tr sf-th">
              <div>Account Name</div>
              <div>Type</div>
              <div>Industry</div>
              <div>Owner</div>
            </div>
            {FAKE_ACCOUNTS.map((a) => (
              <div className="sf-tr" key={a.name}>
                <div className="sf-link">{a.name}</div>
                <div>{a.type}</div>
                <div>{a.industry}</div>
                <div>{a.owner}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <GenieChatWidget mode="floating" account="Acme Corp" owner="Jane Smith" />
    </div>
  );
}
