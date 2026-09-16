import PageBuilder, { type PageBlock } from './PageBuilder';

type Props = {
  value?: unknown[];
  onChange: (blocks: PageBlock[]) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

export default function BrokerEditorialPageBuilder({
  value,
  onChange,
  onUploadImage,
}: Props) {
  return (
    <PageBuilder
      value={value}
      onChange={onChange}
      onUploadImage={onUploadImage}
      context="broker-editorial"
    />
  );
}
