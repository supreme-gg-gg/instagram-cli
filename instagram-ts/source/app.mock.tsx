import React from "react";
import { render, Box } from "ink";
import { ClientContext } from "./ui/context/ClientContext.js";
import { mockClient, mockFeed } from "./mocks/index.js";
import ChatView from "./ui/views/ChatView.js";
import MediaView from "./ui/views/MediaView.js";
import AltScreen from "./ui/components/AltScreen.js";

const MOCK_CONFIG = {
  view: "chat" as "chat" | "media", // Change this to switch views
  // user: "alice_smith",
  // theme: "dark",
  // etc.
};

const AppMock = () => {
  const renderView = () => {
    switch (MOCK_CONFIG.view) {
      case "chat":
        return <ChatView />;
      case "media":
        return <MediaView feed={mockFeed} />;
      default:
        return <ChatView />;
    }
  };

  return (
    <ClientContext.Provider value={mockClient}>
      <AltScreen>
        <Box flexDirection="column" width="100%" height="100%">
          {renderView()}
        </Box>
      </AltScreen>
    </ClientContext.Provider>
  );
};

export const run = () => {
  render(<AppMock />);
};
