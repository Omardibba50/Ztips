import {
  SmartContract,
  state,
  State,
  method,
  Permissions,
  PublicKey,
  Field,
  Struct,
  Poseidon,
  Bool,
  UInt64,
  CircuitString,
} from 'o1js';
import { UserVerificationProof } from '../zkPrograms/UserVerification.js';

class User extends Struct({
  publicKey: PublicKey,
  verificationHash: Field,
}) {}

class Bounty extends Struct({
  id: Field,
  amount: UInt64,
  description: CircuitString,
  seeker: PublicKey,
  provider: PublicKey,
  isCompleted: Bool,
}) {}

export class InfoExchange extends SmartContract {
  @state(Field) nextBountyId = State<Field>();
  @state(Field) userRoot = State<Field>();
  @state(Field) bountyRoot = State<Field>();

  init() {
    super.init();
    this.nextBountyId.set(Field(1));
    this.userRoot.set(Field(0));
    this.bountyRoot.set(Field(0));
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method async registerUser(user: User, proof: UserVerificationProof) {
    proof.verify();

    user.verificationHash.assertEquals(proof.publicOutput);

    const currentUserRoot = this.userRoot.get();
    this.userRoot.requireEquals(currentUserRoot);

    const userFields = Poseidon.hash(User.toFields(user));
    const newUserRoot = Poseidon.hash([currentUserRoot, userFields]);

    this.userRoot.set(newUserRoot);
  }

  @method async createBounty(bounty: Bounty) {
    const currentBountyId = this.nextBountyId.get();
    this.nextBountyId.requireEquals(currentBountyId);

    bounty.id.assertEquals(currentBountyId);

    const currentBountyRoot = this.bountyRoot.get();
    this.bountyRoot.requireEquals(currentBountyRoot);

    const bountyFields = Poseidon.hash(Bounty.toFields(bounty));
    const newBountyRoot = Poseidon.hash([currentBountyRoot, bountyFields]);

    this.bountyRoot.set(newBountyRoot);
    this.nextBountyId.set(currentBountyId.add(1));
  }

  @method async updateBounty(oldBounty: Bounty, newBounty: Bounty) {
    const currentBountyRoot = this.bountyRoot.get();
    this.bountyRoot.requireEquals(currentBountyRoot);

    oldBounty.id.assertEquals(newBounty.id);

    const oldBountyHash = Poseidon.hash(Bounty.toFields(oldBounty));
    const newBountyHash = Poseidon.hash(Bounty.toFields(newBounty));

    const newBountyRoot = Poseidon.hash([
      Poseidon.hash([currentBountyRoot, Field(-1).mul(oldBountyHash)]),
      newBountyHash,
    ]);

    this.bountyRoot.set(newBountyRoot);
  }
}
