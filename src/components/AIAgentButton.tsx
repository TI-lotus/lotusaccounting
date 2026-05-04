import { useEffect } from "react";

interface AIAgentButtonProps {
  className?: string;
  externalOpen?: boolean;
  onExternalClose?: () => void;
  initialMessage?: string;
  onInitialMessageHandled?: () => void;
}

/**
 * Renders the ElevenLabs ConvAI widget directly. The widget itself provides the
 * floating launcher and chat UI — no extra button is needed.
 */
export const AIAgentButton = (_props: AIAgentButtonProps) => {
  useEffect(() => {
    if (document.querySelector('script[src="https://unpkg.com/@elevenlabs/convai-widget-embed"]')) return;
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    script.async = true;
    script.type = "text/javascript";
    document.body.appendChild(script);
  }, []);

  // @ts-expect-error custom element provided by ElevenLabs widget script
  return <elevenlabs-convai agent-id="agent_5801kqb432rmerkv08jnn0f60ypt" />;
};
