# PlotPickle BUZZ live health check

PlotPickle does not treat a successful relay probe or a passing source-code contract as proof that BUZZ is working end to end on the writer's computer.

The Settings live test is an explicit signed round trip through the configured local BUZZ identity:

1. Read the encrypted local BUZZ connection.
2. Confirm the identity was previously verified.
3. Find the private `gatehouse` Guildhall room.
4. Send a uniquely tagged, signed health message through the BUZZ CLI.
5. Read recent `gatehouse` messages back from the relay.
6. Report success only when the exact tag sent by this test is observed on the read path.

The probe contains only an opaque health tag and timestamp. It contains no story content, prompt, model response, credential, hidden reasoning, or private key.

The UI deliberately starts at `Not tested yet`. Merely having all Guildhall rooms present is not enough to display `Signed test message received`.
