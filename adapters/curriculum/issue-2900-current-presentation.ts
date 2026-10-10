import { canonicalTopicDocuments, plotPickleCurriculum } from "./current-catalog";
import { withIssue2900CreativeFocus, withIssue2900CreativeFocusLessons } from "./issue-2900-creative-focus";

/**
 * Current learner / Sage teaching view, layered above the frozen #2094 presentation.
 * Never change audited historical lesson bodies, hashes, identity, completion keys or order.
 */
export const creativeFocusCanonicalTopicDocuments = withIssue2900CreativeFocus(canonicalTopicDocuments);
export const creativeFocusPlotPickleCurriculum = withIssue2900CreativeFocusLessons(plotPickleCurriculum);
