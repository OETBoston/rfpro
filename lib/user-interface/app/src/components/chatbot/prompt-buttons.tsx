import { Button, SpaceBetween } from "@cloudscape-design/components";
import styles from "../../styles/chat.module.scss";

interface PromptButtonsProps {
  onPromptClick: (prompt: string) => void;
  disabled?: boolean;
}

export default function PromptButtons({ onPromptClick, disabled = false }: PromptButtonsProps) {
  const prompts = [
    "What procurement method is most appropriate for purchasing software?",
    "Write a scope of work for a constituent outreach consultant.",
    "How do I find a certified supplier?"
  ];

  return (
    <div style={{ 
      margin: '0 0 8px 0', 
      padding: '0'
    }}>
      <SpaceBetween direction="horizontal" size="xxs">
        {prompts.map((prompt, index) => (
          <div key={index} style={{ flex: 1 }}>
            <Button
              variant="normal"
              disabled={disabled}
              onClick={() => onPromptClick(prompt)}
              fullWidth={true}
            >
              <div style={{ 
                fontSize: '12px', 
                lineHeight: '1.1',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                textAlign: 'left',
                whiteSpace: 'normal',
                padding: '2px 0'
              }}>
                {prompt}
              </div>
            </Button>
          </div>
        ))}
      </SpaceBetween>
    </div>
  );
}
