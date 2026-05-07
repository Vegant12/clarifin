import { DocumentProgressView } from "@/components/doc/document-progress-view";

export default async function DocumentPage(props: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await props.params;

  return <DocumentProgressView documentId={documentId} />;
}
