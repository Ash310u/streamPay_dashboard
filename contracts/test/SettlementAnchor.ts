import { expect } from "chai";
import { ethers } from "hardhat";

describe("SettlementAnchor", () => {
  it("anchors a session hash", async () => {
    const [admin] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("SettlementAnchor");
    const contract = await factory.deploy(admin.address);
    const sessionId = ethers.id("session-1");
    const sessionHash = ethers.id("hash-1");

    await contract.anchorSession(
      sessionId,
      sessionHash,
      ethers.id("merchant-1"),
      ethers.id("venue-1"),
      admin.address,
      10000,
      50
    );

    const anchored = await contract.sessionAnchors(sessionId);
    expect(anchored.sessionHash).to.equal(sessionHash);
    expect(anchored.grossAmount).to.equal(10000);
  });
});
