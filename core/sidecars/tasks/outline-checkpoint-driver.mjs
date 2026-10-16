/** Drive exactly one already-authorized Pi Durable checkpoint. This does not create
 * model authority: registration.admit rechecks the host-owned responsibility
 * scope and budget before the scheduler is started. The scheduler's storage
 * is isolated to the current task by outline-task-gateway.
 *
 * Pi Durable's waitForTask observes task completion; it does not itself start
 * execution of an admitted task. Production must explicitly resume the harness,
 * as the native Pi integration proof already does.
 */
export async function driveAdmittedOutlineCheckpoint({ harness, registration, input, context }) {
  const taskId = await registration.admit(await harness.root(context), input, context);
  await harness.resume();
  return harness.waitForTask(taskId, context);
}
