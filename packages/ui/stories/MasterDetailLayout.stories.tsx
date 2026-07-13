import { MasterDetailLayout } from "../src/master-detail-layout";

export default { title: "W28A-871/MasterDetailLayout", component: MasterDetailLayout };

export const Default = {
  args: {
    master: <div className="p-3">Profiles</div>,
    detail: <div className="p-3">Selected profile detail</div>,
  },
};
