import { ActionableError } from "../src/actionable-error";

export default { title: "W28A-871/ActionableError", component: ActionableError };

export const DeleteBlocked = {
  args: {
    message: "Source connection cannot be deleted while profiles reference it.",
    action: { label: "Unbind 3 profiles first", href: "/profiles?source=w871_seed_pg" },
  },
};
