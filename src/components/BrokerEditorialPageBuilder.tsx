import { useEffect, useMemo, useRef } from 'react';
import PageBuilder, { type PageBlock } from './PageBuilder';

type Props = {
  value?: unknown[];
  onChange: (blocks: PageBlock[]) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

/**
 * Broker Editorial uses the existing unified PageBuilder, but owns only
 * editorial/commercial components. Dedicated broker data cards belong to
 * the Broker page's structured sections and remain available to Guides and
 * Best-For documents.
 */
export default function BrokerEditorialPageBuilder({ value, onChange, onUploadImage }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editorialBlocks = useMemo(
    () => (Array.isArray(value) ? value.filter((block: any) => block?.type !== 'structured_broker_data') : []),
    [value],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const hideBrokerDataControls = () => {
      root.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
        const label = button.textContent?.replace(/\s+/g, ' ').trim().toLowerCase();
        if (label === 'broker data') {
          button.hidden = true;
          button.setAttribute('aria-hidden', 'true');
        }
      });
    };

    hideBrokerDataControls();
    const observer = new MutationObserver(hideBrokerDataControls);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const handleChange = (blocks: PageBlock[]) => {
    onChange(blocks.filter((block) => block.type !== 'structured_broker_data'));
  };

  return (
    <div ref={rootRef}>
      <PageBuilder value={editorialBlocks} onChange={handleChange} onUploadImage={onUploadImage} />
    </div>
  );
}
