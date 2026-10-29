// #3302: INERT F00 Lane A Windows SCM host, .NET Framework 4.8.
// This process never loads keys, starts reviewer work, spawns children,
// accesses the network, modifies the test catalogue, or authorizes admission.
using System;
using System.Security.Principal;
using System.ServiceProcess;

namespace PlotPickle.IndependentQuality
{
    internal sealed class LaneAService : ServiceBase
    {
        private const string FixedName = "PlotPickleLaneA";
        private const string FixedAccount = @"NT SERVICE\PlotPickleLaneA";

        internal LaneAService()
        {
            ServiceName = FixedName;
            AutoLog = false;             // No EventLog source creation as restricted account.
            CanStop = true;
            CanShutdown = true;
            CanPauseAndContinue = false; // No independent review work to pause/replay.
            CanHandlePowerEvent = false;
        }

        // SCM calls OnStart only from the noninteractive service entrypoint.
        protected override void OnStart(string[] args)
        {
            if (args != null && args.Length != 0)
                throw new InvalidOperationException("LANE_A_SERVICE_ARGUMENTS_FORBIDDEN");
            if (Environment.UserInteractive)
                throw new InvalidOperationException("LANE_A_INTERACTIVE_EXECUTION_FORBIDDEN");

            using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
            {
                if (identity == null || identity.User == null || identity.IsSystem)
                    throw new InvalidOperationException("LANE_A_SERVICE_IDENTITY_MISSING");

                // The *actual token*, not the service name in SCM, must be
                // the dedicated virtual account. A separate registrar must
                // independently observe coding SID, privileges and key ACL.
                SecurityIdentifier configured;
                try
                {
                    configured = (SecurityIdentifier)
                        new NTAccount(FixedAccount).Translate(typeof(SecurityIdentifier));
                }
                catch (IdentityNotMappedException)
                {
                    throw new InvalidOperationException("LANE_A_VIRTUAL_ACCOUNT_UNRESOLVED");
                }

                if (!configured.Equals(identity.User))
                    throw new InvalidOperationException("LANE_A_SERVICE_TOKEN_MISMATCH");
            }
            // No key access, reviewer activity, network listener or job loop.
            // SCM RUNNING indicates this diagnostic host only, not admission.
        }

        protected override void OnStop()
        {
            // No child processes or jobs exist. SCM owns the stop acknowledgement.
        }

        protected override void OnShutdown()
        {
            OnStop();
            base.OnShutdown();
        }

        private static int Main(string[] args)
        {
            if (args != null && args.Length == 1 && args[0] == "--self-test")
            {
                // A non-SCM binary smoke test is intentionally NOT a token
                // witness, signing test, service installation, or W8/W9 proof.
                if (Environment.OSVersion.Platform != PlatformID.Win32NT)
                    return 3;
                Console.WriteLine("PP-LANE-A-SCM-HOST-V1:INERT_SELF_TEST_ONLY");
                return 0;
            }

            if (args != null && args.Length != 0)
                return 2;

            if (Environment.OSVersion.Platform != PlatformID.Win32NT)
                return 3;

            ServiceBase.Run(new LaneAService());
            return 0;
        }
    }
}
