import { expect } from "chai";
import { ethers } from "hardhat";

describe("DetrixSessionManager", () => {
  it("starts, closes and disputes a session", async () => {
    const [admin] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("DetrixSessionManager");
    const contract = await factory.deploy(admin.address);
    const sessionId = ethers.id("session-1");

    await contract.startSession(
      sessionId,
      ethers.id("merchant-1"),
      ethers.id("venue-1"),
      ethers.id("user-1"),
      ethers.id("plan-1"),
      "superfluid:stream-1"
    );

    await contract.closeSession(sessionId, ethers.id("session-hash"));
    await contract.flagDispute(sessionId, ethers.id("dispute-hash"));

    const session = await contract.getSession(sessionId);
    expect(session.status).to.equal(3);
  });
});

