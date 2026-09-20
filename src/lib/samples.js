/* Shared sample data: simulator defaults + practice cases. */

export const WEAK_SAMPLE = {
  owner: "Employee", ownerPK: "Emp_ID", ownerAttrs: "Name, Department",
  weak: "Dependent", partialKey: "Dependent_Name", weakAttrs: "Age, Relationship_Type",
  relationship: "Has_Dependent", cardinality: "1:N", participation: "Total"
};

export const AGG_SAMPLE = {
  entity1: "Employee", entity2: "Project", relationship: "Works_On",
  relAttrs: "Hours_Per_Week, Role", higherEntity: "Manager", higherRelationship: "Supervises"
};

export const PRACTICE_EXAMPLES = [
  {
    id: "p1", type: "weak", title: "Employee — Dependent (Valid)", valid: true,
    desc: "Classic textbook weak entity: Dependent cannot be identified without knowing which Employee it belongs to.",
    data: { ...WEAK_SAMPLE }
  },
  {
    id: "p2", type: "weak", title: "Order — OrderItem (Valid)", valid: true,
    desc: "OrderItem rows are only meaningful combined with their parent Order's key.",
    data: { owner: "Order", ownerPK: "Order_ID", ownerAttrs: "Order_Date, Total", weak: "OrderItem", partialKey: "Line_No", weakAttrs: "Quantity, Unit_Price", relationship: "Contains_Item", cardinality: "1:N", participation: "Total" }
  },
  {
    id: "p3", type: "weak", title: "Missing Partial Key (Invalid)", valid: false,
    desc: "A weak entity is defined without a discriminator/partial key — this must be rejected.",
    data: { owner: "Hotel", ownerPK: "Hotel_ID", ownerAttrs: "City", weak: "Room", partialKey: "", weakAttrs: "Room_Type", relationship: "Has_Room", cardinality: "1:N", participation: "Total" }
  },
  {
    id: "p4", type: "weak", title: "Missing Owner Primary Key (Invalid)", valid: false,
    desc: "Owner entity exists but has no declared primary key — the composite identifying key cannot be formed.",
    data: { owner: "Building", ownerPK: "", ownerAttrs: "Address", weak: "Floor", partialKey: "Floor_No", weakAttrs: "Area_Sqft", relationship: "Has_Floor", cardinality: "1:N", participation: "Total" }
  },
  {
    id: "p5", type: "weak", title: "Partial Participation (Invalid)", valid: false,
    desc: "Participation is marked Partial instead of Total — violates the existence-dependency rule of weak entities.",
    data: { owner: "Course", ownerPK: "Course_ID", ownerAttrs: "Title", weak: "Section", partialKey: "Section_No", weakAttrs: "Timing", relationship: "Has_Section", cardinality: "1:N", participation: "Partial" }
  },
  {
    id: "p6", type: "agg", title: "Employee–Works_On–Project → Manager (Valid)", valid: true,
    desc: "Standard aggregation example: abstracting an assignment relationship so a Manager can oversee it.",
    data: { ...AGG_SAMPLE }
  },
  {
    id: "p7", type: "agg", title: "Missing Relationship (Invalid)", valid: false,
    desc: "Two entities are given but no relationship connects them — aggregation has nothing to abstract.",
    data: { entity1: "Doctor", entity2: "Patient", relationship: "", relAttrs: "Date", higherEntity: "Treatment", higherRelationship: "Reviewed_By" }
  }
];
