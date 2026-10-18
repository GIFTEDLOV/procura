# Fee policy

## Active Studionet release

The current frontend is pinned to stable `genlayer-js@1.1.8` on Studionet
chain `61999`. Its writer estimates gas for the exact call with
`eth_estimateGas`, reads `eth_gasPrice`, and passes the transaction request to
the connected wallet. The wallet remains responsible for signing and showing
the final network fee before submission. The active frontend does not call the
newer release-candidate fee estimator or import the historical Studio-dev fee
profile.

External payout methods remain disabled in the active LIVE adapter until a
Studionet external-message fee policy is independently measured and verified.
The qualification sequence made no external payouts. Its recorded contract
liability is documented separately in the live qualification journal; the
0.0001 GEN test escrow is not a protocol-fee estimate.

## Historical Studio-dev chain 61997 records

The following records are preserved for the former Studio-dev deployment and
must not be used for Studionet transactions. The canonical historical profile
is `evidence/studio-dev-fee-profile.json`.

That profile recorded a 500000 gas limit, 250000000 maximum gas price, and
125000000000000 wei external-message budget for the buyer refund and supplier
settlement routes. The recipient was derived from canonical buyer or supplier
state, and the call key was derived from empty calldata. These values applied
only to the Studio-dev release.

The historical fee-policy tests preserve those measurements. Deployment #5
and Deployment #6 used nonzero fee quotes and external message allocations;
their gross escrow exits and net wallet deltas are recorded in archived
deployment evidence. Those historical writes do not establish a Studionet
fee profile.
