import { PageLayout } from '@app/components/PageLayout';
import { PeopleManagementView } from '@shared/components/PeopleManagementView';

export function ManagePeopleScreen() {
  return (
    <PageLayout title="Manage People">
      <div className="p-3.5">
        <PeopleManagementView mode="mobile" />
      </div>
    </PageLayout>
  );
}

export default ManagePeopleScreen;
