/** Physical constants used by the mission analyses (SI unless the name says otherwise). */
export const MU_EARTH_KM3_S2 = 398600.4418;
export const R_EARTH_KM = 6378.137;
export const J2 = 1.08263e-3;
export const SOLAR_CONSTANT_W_M2 = 1367;
export const BOLTZMANN_J_K = 1.380649e-23;
export const BOLTZMANN_DBW_K_HZ = -228.6;
export const SPEED_OF_LIGHT_KM_S = 299792.458;
export const G0_M_S2 = 9.80665;
export const STEFAN_BOLTZMANN_W_M2_K4 = 5.670374e-8;
/** Nodal regression rate of a sun-synchronous orbit (2π rad per tropical year). */
export const SSO_NODAL_RATE_RAD_S = 1.991e-7;
export const SIDEREAL_DAY_S = 86164.0905;
export const AU_KM = 149597870.7;
export const EARTH_IR_W_M2 = 237;
export const EARTH_ALBEDO = 0.3;

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

/** Every analysis returns its numbers plus "the maths", so the UI can show the working. */
export type Explained<T> = T & {
  formula: string;
  assumptions: string[];
  source: string;
};
