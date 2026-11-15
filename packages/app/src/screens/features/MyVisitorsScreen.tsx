import { VisitorsDirectoryView, type VisitorsDirectoryViewProps } from '@shared/components/gate/VisitorsDirectoryView';

export function MyVisitorsScreen({ initialTab }: { initialTab?: VisitorsDirectoryViewProps['initialTab'] }) {
  return <VisitorsDirectoryView standalone initialTab={initialTab} />;
}

export default MyVisitorsScreen;
