import { type Task } from "./schema";

export const sampleTasks: Record<string, Task[]> = {
  family: [
    {
      id: "fam-1",
      title: "👨‍👩‍👧‍👦 Book summer trip 🔥 This Week",
      notes: "Target: family | Urgency: high",
      status: "needsAction",
      due: undefined,
      updated: undefined,
      listId: "FAMILY_LIST_ID",
      targetList: "family",
      urgency: "high"
    }
  ],
  homeImprovement: [
    {
      id: "hi-1",
      title: "🛠️ Paint the living room Next Week",
      notes: "Target: homeImprovement | Urgency: medium",
      status: "needsAction",
      due: undefined,
      updated: undefined,
      listId: "HOME_IMPROVEMENT_LIST_ID",
      targetList: "homeImprovement",
      urgency: "medium"
    }
  ],
  homeMaintenance: [
    {
      id: "hm-1",
      title: "🧰 Change HVAC filter Later",
      notes: "Target: homeMaintenance | Urgency: low",
      status: "needsAction",
      due: undefined,
      updated: undefined,
      listId: "HOME_MAINTENANCE_LIST_ID",
      targetList: "homeMaintenance",
      urgency: "low"
    }
  ],
  square: [
    {
      id: "sq-1",
      title: "🏢 Prepare Square monthly report 🔥 This Week",
      notes: "Target: square | Urgency: high",
      status: "needsAction",
      due: undefined,
      updated: undefined,
      listId: "SQUARE_LIST_ID",
      targetList: "square",
      urgency: "high"
    }
  ]
};
